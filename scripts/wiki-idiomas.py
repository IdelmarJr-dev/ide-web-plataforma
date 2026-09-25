#!/usr/bin/env python3
"""Acrescenta o seletor de idioma (EN | PT) ao index.html gerado pelo CodeWiki.

O CodeWiki gera um viewer só em inglês. Este script é idempotente: rode-o de novo
sempre que o index.html for regenerado (`codewiki generate --github-pages` ou o
HTMLGenerator).

    python scripts/wiki-idiomas.py [caminho/do/index.html]

Convenção da wiki: a versão em inglês fica em repowiki/*.md e a em português em
repowiki/pt-br/*.md, com os mesmos nomes de arquivo. Por isso os links entre
documentos (`[x](backend_auth.md)`) servem aos dois idiomas. Se uma página ainda não
existir em pt-br/, o viewer mostra a versão em inglês com um aviso.

Idioma escolhido: ?lang=pt|en na URL, senão o último salvo (localStorage), senão o
idioma do navegador (pt* -> português, o resto -> inglês).
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

MARCADOR = "/* wiki-idiomas */"

BLOCO_I18N = MARCADOR + r"""
        const I18N = {
            en: {
                docLang: 'en', toggleLabel: 'PT', toggleTitle: 'Ler em português',
                menu: 'Toggle navigation', theme: 'Toggle dark mode', repo: '🔗 View Repository',
                info: 'Generation Info', filter: 'Filter pages…', filterAria: 'Filter pages',
                overview: 'Overview', overviewNav: '📄 Overview', loading: 'Loading documentation...',
                pagerAria: 'Previous and next page', tocAria: 'Table of contents', toc: 'On this page',
                prev: '← Previous', next: 'Next →', copy: 'Copy', copied: 'Copied!',
                section: 'Toggle section', errorTitle: '⚠️ Error', failed: 'Failed to load document: ',
                fallback: '', zoomOut: 'Zoom out', zoomIn: 'Zoom in', reset: 'Reset view', fit: 'Fit', close: 'Close (Esc)'
            },
            pt: {
                docLang: 'pt-BR', toggleLabel: 'EN', toggleTitle: 'Read in English',
                menu: 'Alternar navegação', theme: 'Alternar modo escuro', repo: '🔗 Ver repositório',
                info: 'Informações da geração', filter: 'Filtrar páginas…', filterAria: 'Filtrar páginas',
                overview: 'Visão geral', overviewNav: '📄 Visão geral', loading: 'Carregando documentação...',
                pagerAria: 'Página anterior e próxima', tocAria: 'Índice da página', toc: 'Nesta página',
                prev: '← Anterior', next: 'Próxima →', copy: 'Copiar', copied: 'Copiado!',
                section: 'Alternar seção', errorTitle: '⚠️ Erro', failed: 'Não foi possível carregar o documento: ',
                fallback: '> **Esta página ainda não foi traduzida para o português.** Exibindo a versão em inglês.\n\n',
                zoomOut: 'Diminuir', zoomIn: 'Ampliar', reset: 'Reiniciar visão', fit: 'Ajustar', close: 'Fechar (Esc)'
            }
        };

        function idiomaInicial() {
            try {
                const daUrl = new URLSearchParams(location.search).get('lang');
                if (daUrl === 'pt' || daUrl === 'en') return daUrl;
                const salvo = localStorage.getItem('codewiki-lang');
                if (salvo === 'pt' || salvo === 'en') return salvo;
            } catch (e) {
                // Sem armazenamento (modo privado): segue pelo idioma do navegador
            }
            return (navigator.language || '').toLowerCase().indexOf('pt') === 0 ? 'pt' : 'en';
        }

        let LANG = idiomaInicial();
        function t(chave) { return I18N[LANG][chave]; }

        // Versão em português vive em pt-br/; a em inglês, na raiz. Mesmo nome de arquivo.
        function caminhoDoc(filename, idioma) {
            const base = DOCS_BASE_PATH ? DOCS_BASE_PATH + '/' + filename : filename;
            return idioma === 'pt' ? 'pt-br/' + base : base;
        }

        function aplicarIdioma() {
            document.documentElement.lang = t('docLang');
            const texto = (id, valor) => { const el = document.getElementById(id); if (el) el.textContent = valor; };
            const attr = (id, nome, valor) => { const el = document.getElementById(id); if (el) el.setAttribute(nome, valor); };
            attr('menu-toggle', 'aria-label', t('menu'));
            attr('theme-toggle', 'aria-label', t('theme'));
            attr('nav-filter', 'placeholder', t('filter'));
            attr('nav-filter', 'aria-label', t('filterAria'));
            attr('pager', 'aria-label', t('pagerAria'));
            attr('toc', 'aria-label', t('tocAria'));
            texto('lang-toggle', t('toggleLabel'));
            attr('lang-toggle', 'title', t('toggleTitle'));
            attr('lang-toggle', 'aria-label', t('toggleTitle'));
            const repo = document.querySelector('.repo-link'); if (repo) repo.textContent = t('repo');
            const info = document.querySelector('#repo-info h4'); if (info) info.textContent = t('info');
            const inicio = document.querySelector('.nav-section .nav-item[data-file="overview.md"]');
            if (inicio) inicio.textContent = t('overviewNav');
            const carregando = document.querySelector('#loading p'); if (carregando) carregando.textContent = t('loading');
            document.querySelectorAll('.nav-toggle').forEach(el => el.setAttribute('aria-label', t('section')));
        }

        function setupLangToggle() {
            document.getElementById('lang-toggle').addEventListener('click', function() {
                LANG = LANG === 'pt' ? 'en' : 'pt';
                try { localStorage.setItem('codewiki-lang', LANG); } catch (e) { /* não persiste */ }
                aplicarIdioma();
                const rota = parseHash();
                currentFile = null;
                loadDocument(rota.file, rota.anchor);
            });
        }
"""


def substituir(texto: str, antigo: str, novo: str, vezes: int = 1) -> str:
    achados = texto.count(antigo)
    if achados != vezes:
        raise SystemExit(f"Trecho esperado {vezes}x, encontrado {achados}x: {antigo[:70]!r}")
    return texto.replace(antigo, novo)


def aplicar(html: str) -> str:
    if MARCADOR in html:
        return html

    # 1. Botão de idioma ao lado do de tema.
    html = substituir(
        html,
        '<button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle dark mode">🌙</button>',
        '<span class="sidebar-botoes" style="display:flex;gap:6px;align-items:center;">'
        '<button class="theme-toggle" id="lang-toggle" type="button" aria-label="Ler em português" '
        'style="font-size:12px;font-weight:600;">PT</button>'
        '<button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle dark mode">🌙</button></span>',
    )

    # 2. Estado e utilitários de idioma, logo depois das constantes do viewer.
    html = substituir(html, "const DOCS_BASE_PATH = '';", "const DOCS_BASE_PATH = '';\n" + BLOCO_I18N)

    # 3. Inicialização.
    html = substituir(
        html,
        "            setupThemeToggle();\n            setupMobileDrawer();",
        "            setupThemeToggle();\n            setupLangToggle();\n            aplicarIdioma();\n            setupMobileDrawer();",
    )

    # 4. Carregamento com fallback para o inglês quando a página não foi traduzida.
    html = substituir(
        html,
        "                const docPath = DOCS_BASE_PATH ? DOCS_BASE_PATH + '/' + filename : filename;\n"
        "                const response = await fetch(docPath);\n"
        "                if (!response.ok) {\n"
        "                    throw new Error('Failed to load ' + filename);\n"
        "                }\n"
        "\n"
        "                const markdown = await response.text();",
        "                let response = await fetch(caminhoDoc(filename, LANG));\n"
        "                let semTraducao = false;\n"
        "                if (!response.ok && LANG === 'pt') {\n"
        "                    response = await fetch(caminhoDoc(filename, 'en'));\n"
        "                    semTraducao = response.ok;\n"
        "                }\n"
        "                if (!response.ok) {\n"
        "                    throw new Error('Failed to load ' + filename);\n"
        "                }\n"
        "\n"
        "                const markdown = (semTraducao ? t('fallback') : '') + await response.text();",
    )
    html = substituir(html, "showError('Failed to load document: ' + filename);", "showError(t('failed') + filename);")

    # 5. Textos dinâmicos.
    html = substituir(html, "'<span class=\"pager-label\">← Previous</span>'", "'<span class=\"pager-label\">' + t('prev') + '</span>'")
    html = substituir(html, "'<span class=\"pager-label\">Next →</span>'", "'<span class=\"pager-label\">' + t('next') + '</span>'")
    html = substituir(html, "'<div class=\"toc-title\">On this page</div>'", "'<div class=\"toc-title\">' + t('toc') + '</div>'")
    html = substituir(html, "return base === 'overview' ? 'Overview' : formatNavTitle(base);", "return base === 'overview' ? t('overview') : formatNavTitle(base);")
    html = substituir(html, "btn.textContent = 'Copy';", "btn.textContent = t('copy');", vezes=2)
    html = substituir(html, "btn.textContent = 'Copied!';", "btn.textContent = t('copied');")
    html = substituir(html, "'<div class=\"error\"><h3>⚠️ Error</h3><p>'", "'<div class=\"error\"><h3>' + t('errorTitle') + '</h3><p>'")
    html = substituir(html, 'aria-label="Toggle section">▸</button>', "aria-label=\"' + t('section') + '\">▸</button>")
    html = substituir(
        html,
        "title=\"Zoom out\" aria-label=\"Zoom out\">−</button>",
        "title=\"' + t('zoomOut') + '\" aria-label=\"' + t('zoomOut') + '\">−</button>",
    )
    html = substituir(
        html,
        "title=\"Zoom in\" aria-label=\"Zoom in\">+</button>",
        "title=\"' + t('zoomIn') + '\" aria-label=\"' + t('zoomIn') + '\">+</button>",
    )
    html = substituir(
        html,
        "title=\"Reset view\" aria-label=\"Reset view\">Fit</button>",
        "title=\"' + t('reset') + '\" aria-label=\"' + t('reset') + '\">' + t('fit') + '</button>",
    )
    html = substituir(
        html,
        "title=\"Close (Esc)\" aria-label=\"Close\">✕</button>",
        "title=\"' + t('close') + '\" aria-label=\"' + t('close') + '\">✕</button>",
    )
    return html


def main() -> None:
    caminho = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "repowiki" / "index.html"
    original = io.open(caminho, encoding="utf-8", newline="").read()
    # O arquivo gerado no Windows vem com CRLF; os trechos acima usam LF.
    quebra = "\r\n" if "\r\n" in original else "\n"
    normalizado = original.replace("\r\n", "\n")
    novo = aplicar(normalizado)
    if novo == normalizado:
        print(f"{caminho}: já tem o seletor de idioma, nada a fazer.")
        return
    io.open(caminho, "w", encoding="utf-8", newline="").write(novo.replace("\n", quebra))
    print(f"{caminho}: seletor de idioma aplicado.")


if __name__ == "__main__":
    main()
