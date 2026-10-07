#!/usr/bin/env python3
"""Tratamento estatístico do CSV exportado pela pesquisa do TCC.

Implementa o passo documentado em docs/checklist-dia-da-coleta.md ("Análise
estatística fora do sistema: normalidade -> t de Student ou Mann-Whitney, sobre
sus_total e rtlx_total por grupo") -- até agora só existia como item de checklist,
sem script. Le o CSV anonimizado (colunas participante, grupo, sus_total, rtlx_total,
...; ver ide-web-front/src/features/pesquisa/utils/csvPesquisa.ts para o formato
exato), compara o grupo "experimental" (usou a ferramenta) contra o "controle"
(ferramentas tradicionais) em cada métrica:

  1. Estatística descritiva por grupo (n, média, desvio-padrão, mediana).
  2. Teste de normalidade por grupo (Shapiro-Wilk).
  3. Se as duas distribuições parecem normais -> teste t de Welch (não assume
     variâncias iguais, mais seguro que o t de Student clássico com amostras
     pequenas e desiguais). Caso contrário -> Mann-Whitney U.

Uso:
    python analisar.py caminho/para/exportacao.csv [--alpha 0.05] [--saida relatorio.md]

Dependências: pandas, scipy (ver requirements.txt nesta pasta).
"""
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    import pandas as pd
    from scipy import stats
except ImportError as erro:
    sys.stderr.write(
        "Faltam dependências. Rode: pip install -r "
        f"{Path(__file__).parent / 'requirements.txt'}\n(erro original: {erro})\n"
    )
    sys.exit(1)

GRUPO_EXPERIMENTAL = "experimental"
GRUPO_CONTROLE = "controle"
MIN_AMOSTRAS_SHAPIRO = 3
METRICAS = ("sus_total", "rtlx_total")


@dataclass
class ResultadoGrupo:
    grupo: str
    n: int
    media: float
    desvio_padrao: float
    mediana: float
    normal: bool | None
    p_normalidade: float | None


@dataclass
class ResultadoComparacao:
    metrica: str
    grupos: list[ResultadoGrupo]
    teste_usado: str
    estatistica: float
    p_valor: float
    significativo: bool


def descrever_grupo(valores: "pd.Series[float]", grupo: str, alpha: float) -> ResultadoGrupo:
    n = int(valores.count())
    normal: bool | None = None
    p_normalidade: float | None = None

    if n >= MIN_AMOSTRAS_SHAPIRO:
        estatistica_shapiro, p_normalidade = stats.shapiro(valores)
        normal = p_normalidade > alpha
    else:
        sys.stderr.write(
            f"[aviso] grupo '{grupo}' tem só {n} amostra(s) — "
            f"Shapiro-Wilk precisa de pelo menos {MIN_AMOSTRAS_SHAPIRO}, pulando teste de normalidade.\n"
        )

    return ResultadoGrupo(
        grupo=grupo,
        n=n,
        media=float(valores.mean()) if n > 0 else float("nan"),
        desvio_padrao=float(valores.std()) if n > 1 else float("nan"),
        mediana=float(valores.median()) if n > 0 else float("nan"),
        normal=normal,
        p_normalidade=p_normalidade,
    )


def comparar_metrica(df: "pd.DataFrame", metrica: str, alpha: float) -> ResultadoComparacao | None:
    if metrica not in df.columns:
        sys.stderr.write(f"[aviso] coluna '{metrica}' não existe no CSV, pulando.\n")
        return None

    valores_experimental = df.loc[df["grupo"] == GRUPO_EXPERIMENTAL, metrica].dropna()
    valores_controle = df.loc[df["grupo"] == GRUPO_CONTROLE, metrica].dropna()

    grupo_experimental = descrever_grupo(valores_experimental, GRUPO_EXPERIMENTAL, alpha)
    grupo_controle = descrever_grupo(valores_controle, GRUPO_CONTROLE, alpha)

    if grupo_experimental.n == 0 or grupo_controle.n == 0:
        sys.stderr.write(f"[aviso] '{metrica}': um dos grupos não tem dado, pulando comparação.\n")
        return None

    ambos_normais = bool(grupo_experimental.normal) and bool(grupo_controle.normal)

    if ambos_normais:
        estatistica, p_valor = stats.ttest_ind(valores_experimental, valores_controle, equal_var=False)
        teste_usado = "t de Welch"
    else:
        estatistica, p_valor = stats.mannwhitneyu(valores_experimental, valores_controle, alternative="two-sided")
        teste_usado = "Mann-Whitney U"

    return ResultadoComparacao(
        metrica=metrica,
        grupos=[grupo_experimental, grupo_controle],
        teste_usado=teste_usado,
        estatistica=float(estatistica),
        p_valor=float(p_valor),
        significativo=p_valor < alpha,
    )


def formatar_relatorio(resultados: list[ResultadoComparacao], alpha: float, origem: Path) -> str:
    linhas = [
        "# Relatório de análise estatística — pesquisa do TCC",
        "",
        f"Arquivo de origem: `{origem}`",
        f"Nível de significância (alpha): {alpha}",
        "",
    ]

    for resultado in resultados:
        linhas.append(f"## {resultado.metrica}")
        linhas.append("")
        linhas.append("| Grupo | n | Média | Desvio-padrão | Mediana | Normal? (Shapiro-Wilk, p) |")
        linhas.append("|---|---|---|---|---|---|")
        for grupo in resultado.grupos:
            p_formatado = f"{grupo.p_normalidade:.4f}" if grupo.p_normalidade is not None else "—"
            normal_formatado = "sim" if grupo.normal else ("não" if grupo.normal is False else "não calculado")
            linhas.append(
                f"| {grupo.grupo} | {grupo.n} | {grupo.media:.2f} | {grupo.desvio_padrao:.2f} | "
                f"{grupo.mediana:.2f} | {normal_formatado} (p={p_formatado}) |"
            )
        linhas.append("")
        conclusao = "diferença estatisticamente significativa" if resultado.significativo else "sem diferença significativa"
        linhas.append(
            f"Teste usado: **{resultado.teste_usado}** — estatística={resultado.estatistica:.4f}, "
            f"p={resultado.p_valor:.4f} ({conclusao} com alpha={alpha})."
        )
        linhas.append("")

    linhas.append(
        "_Gerado automaticamente por scripts/analise-pesquisa/analisar.py. "
        "Resultado depende inteiramente da qualidade/tamanho da amostra real coletada — "
        "não tire conclusão de pesquisa de uma amostra de simulação/teste._"
    )
    return "\n".join(linhas)


def main() -> None:
    # Console do Windows às vezes usa um codepage legado (cp1252/cp437) em vez de
    # UTF-8, o que bagunça acento no stdout. reconfigure existe desde o Python 3.7.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Compara grupo experimental x controle (SUS/RTLX) do CSV da pesquisa.")
    parser.add_argument("csv", type=Path, help="Caminho do CSV exportado pelo pesquisador (/admin/pesquisa).")
    parser.add_argument("--alpha", type=float, default=0.05, help="Nível de significância (padrão: 0.05).")
    parser.add_argument("--saida", type=Path, default=None, help="Caminho do relatório .md de saída (opcional).")
    argumentos = parser.parse_args()

    if not argumentos.csv.exists():
        sys.stderr.write(f"Arquivo não encontrado: {argumentos.csv}\n")
        sys.exit(1)

    df = pd.read_csv(argumentos.csv, encoding="utf-8-sig")

    colunas_obrigatorias = {"grupo", *METRICAS}
    faltando = colunas_obrigatorias - set(df.columns)
    if faltando:
        sys.stderr.write(f"CSV não tem as colunas esperadas: {sorted(faltando)}\n")
        sys.exit(1)

    resultados = [r for r in (comparar_metrica(df, metrica, argumentos.alpha) for metrica in METRICAS) if r is not None]

    if not resultados:
        sys.stderr.write("Nenhuma métrica pôde ser comparada — confira o CSV.\n")
        sys.exit(1)

    relatorio = formatar_relatorio(resultados, argumentos.alpha, argumentos.csv)
    print(relatorio)

    if argumentos.saida is not None:
        argumentos.saida.write_text(relatorio, encoding="utf-8")
        print(f"\n[salvo em {argumentos.saida}]", file=sys.stderr)


if __name__ == "__main__":
    main()
