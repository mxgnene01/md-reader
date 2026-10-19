import MD_PLUGINS from '@/config/md-plugins'
import PAGE_THEMES from '@/config/page-themes'
import i18n from '@/config/i18n'
import { getConfiguredFolderRootPaths } from '@/core/folder-roots'
import { resolveHiddenItems } from '@/core/hidden-items'

export const FOLDER_SORT_ORDERS = [
  'name-asc',
  'name-desc',
  'modified-desc',
  'modified-asc',
] as const

export type FolderSortOrder = typeof FOLDER_SORT_ORDERS[number]

export interface Data {
  enable?: boolean
  refresh?: boolean
  language?: string
  centered?: boolean
  mdPlugins?: typeof MD_PLUGINS
  pageTheme?: typeof PAGE_THEMES[0]
  hiddenSide?: boolean
  folderPaneRatio?: number
  folderRootPaths?: string[]
  /** Legacy single-root setting. Kept only for automatic migration. */
  folderRootPath?: string
  folderSortOrder?: FolderSortOrder
  /** `|`-separated names or globs hidden from the folder browser. */
  folderHiddenItems?: string
}

export function getDefaultData(mergeData: Data = {}): Data {
  return {
    enable: true,
    refresh: false,
    centered: true,
    hiddenSide: false,
    folderPaneRatio: 0.42,
    folderSortOrder: 'name-desc',
    language: i18n().locale,
    mdPlugins: [...MD_PLUGINS],
    pageTheme: PAGE_THEMES[0],
    ...mergeData,
    folderRootPaths: getConfiguredFolderRootPaths(mergeData),
    folderHiddenItems: resolveHiddenItems(mergeData.folderHiddenItems),
  }
}
