export interface PaginatedResult<TItem> {
  items: TItem[]
  total: number
  page: number
  pageSize: number
}

export type Nullable<TValue> = TValue | null
