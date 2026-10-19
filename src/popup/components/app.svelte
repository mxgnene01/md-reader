<script lang="ts">
  import storage from '@/core/storage'
  import Warning from './warning.svelte'
  import Header from './header.svelte'
  import Radio from '@smui/radio'
  import Switch from '@smui/switch'
  import FormField from '@smui/form-field'
  import Select, { Option } from '@smui/select'
  import Chip, { Set, Text } from '@smui/chips'
  import MD_PLUGINS from '@/config/md-plugins'
  import PAGE_THEMES from '@/config/page-themes'
  import { getDefaultData, type Data } from '@/core/data'
  import pkg from '../../../package.json'
  import i18n from '@/config/i18n'

  let localize = i18n()
  let homepage = pkg.homepage
  let isAllowViewFile = true
  let data = getDefaultData()
  let newFolderRootPath = ''

  // Get if file allowed access
  chrome.extension.isAllowedFileSchemeAccess(
    (isAllow: boolean) => (isAllowViewFile = !!isAllow),
  )

  storage.get().then((_data: Data) => {
    // need an assignment to updata UI
    data = getDefaultData(_data)
    if (!Array.isArray(_data.folderRootPaths) && data.folderRootPaths.length) {
      updateConfig('folderRootPaths', data.folderRootPaths)
    }
  })

  $: if (data.language) {
    updateConfig('language', data.language)
    changeLocale(data.language)
  }

  function updateConfig(key, value) {
    setTimeout(() => {
      chrome.runtime.sendMessage({ action: 'storage', data: { key, value } })
    }, 0)
  }

  function changeLocale(language) {
    localize = i18n(language)
  }

  function saveFolderRootPaths(paths: string[]) {
    const seen = new Set<string>()
    const folderRootPaths = paths.reduce<string[]>((items, value) => {
      const path = value.trim()
      if (!path || seen.has(path)) return items
      seen.add(path)
      items.push(path)
      return items
    }, [])
    data = { ...data, folderRootPaths }
    updateConfig('folderRootPaths', folderRootPaths)
  }

  function updateFolderRootPath(index: number, event: Event) {
    const paths = [...data.folderRootPaths]
    paths[index] = (event.currentTarget as HTMLInputElement).value
    saveFolderRootPaths(paths)
  }

  function removeFolderRootPath(index: number) {
    saveFolderRootPaths(data.folderRootPaths.filter((_, i) => i !== index))
  }

  function addFolderRootPath() {
    const path = newFolderRootPath.trim()
    if (!path) return
    saveFolderRootPaths([...data.folderRootPaths, path])
    newFolderRootPath = ''
  }

  function handleNewFolderRootKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    addFolderRootPath()
  }
</script>

<main>
  <Header {homepage} />

  {#if !isAllowViewFile}
    <Warning {localize} />
  {/if}

  <div class="form" disabled={!data.enable}>
    <div class="form-item inline">
      <span class="label-item">{localize('label_enable')}:</span>
      <FormField align="end">
        <Switch
          bind:checked={data.enable}
          color="primary"
          on:change={() => updateConfig('enable', data.enable)}
        />
      </FormField>
    </div>

    <div class="form-item inline">
      <span class="label-item">{localize('label_centered')}:</span>
      <FormField align="end">
        <Switch
          disabled={!data.enable}
          bind:checked={data.centered}
          color="primary"
          on:change={() => updateConfig('centered', data.centered)}
        />
      </FormField>
    </div>

    <div class="form-item inline">
      <span class="label-item">{localize('label_auto-refresh')}:</span>
      <FormField align="end">
        <Switch
          disabled={!data.enable}
          bind:checked={data.refresh}
          color="primary"
          on:change={() => updateConfig('refresh', data.refresh)}
        />
      </FormField>
    </div>

    <div class="form-item">
      <div class="label-item">{localize('label_folder-roots')}:</div>
      <div class="root-list">
        {#each data.folderRootPaths as path, index}
          <div class="root-row">
            <input
              class="path-input"
              disabled={!data.enable}
              value={path}
              title={path}
              aria-label={`${localize('label_folder-root')} ${index + 1}`}
              on:change={event => updateFolderRootPath(index, event)}
            />
            <button
              class="root-remove"
              type="button"
              disabled={!data.enable}
              title={localize('remove_folder-root')}
              aria-label={localize('remove_folder-root')}
              on:click={() => removeFolderRootPath(index)}>×</button
            >
          </div>
        {/each}
      </div>
      <div class="root-row root-add">
        <input
          class="path-input"
          disabled={!data.enable}
          bind:value={newFolderRootPath}
          placeholder={localize('placeholder_folder-root')}
          on:keydown={handleNewFolderRootKeydown}
        />
        <button
          class="root-add-button"
          type="button"
          disabled={!data.enable || !newFolderRootPath.trim()}
          on:click={addFolderRootPath}>{localize('add_folder-root')}</button
        >
      </div>
      <div class="help-item">{localize('help_folder-root')}</div>
    </div>

    <div class="form-item">
      <div class="label-item">{localize('label_md-plugins')}:</div>
      <Set
        let:chip
        bind:selected={data.mdPlugins}
        chips={MD_PLUGINS}
        nonInteractive={!data.enable}
        filter={data.enable}
      >
        <Chip
          {chip}
          title={chip}
          on:click={() =>
            data.enable && updateConfig('mdPlugins', data.mdPlugins)}
          ><Text>{localize(chip)}</Text></Chip
        >
      </Set>
    </div>

    <div class="form-item">
      <div class="label-item">{localize('label_theme')}:</div>
      {#each PAGE_THEMES as mode}
        <FormField>
          <span slot="label"> {localize(mode)} </span>
          <Radio
            disabled={!data.enable}
            bind:group={data.pageTheme}
            bind:value={mode}
            on:change={() => updateConfig('pageTheme', mode)}
          />
        </FormField>
      {/each}
    </div>

    <div class="form-item">
      <div class="label-item">{localize('label_language')}:</div>
      <FormField style="padding-left: 10px">
        <Select bind:value={data.language}>
          {#each i18n.locales as locale}
            <Option value={locale}>{localize(locale)}</Option>
          {/each}
        </Select>
      </FormField>
    </div>
  </div>
</main>

<style>
  main {
    overflow: auto;
    box-sizing: border-box;
    width: 330px;
    max-height: 599px;
    padding: 22px 24px 10px;
    border: 1px solid #24315870;
    border-radius: 1px;
  }
  .form-item {
    margin-bottom: 6px;
  }
  .form-item.inline {
    display: flex;
    justify-content: space-between;
    margin-bottom: 15px;
  }
  .label-item {
    font-weight: bolder;
    font-size: 13px;
    color: #243158e3;
  }
  .path-input {
    box-sizing: border-box;
    width: 100%;
    margin-top: 7px;
    padding: 7px 8px;
    border: 1px solid #24315870;
    border-radius: 4px;
    font-size: 12px;
  }
  .root-list {
    margin-top: 7px;
  }
  .root-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }
  .root-row .path-input {
    min-width: 0;
    margin-top: 0;
  }
  .root-add {
    margin-top: 7px;
  }
  .root-remove,
  .root-add-button {
    flex: none;
    min-height: 29px;
    border: 1px solid #24315870;
    border-radius: 4px;
    color: #243158e3;
    background: transparent;
    cursor: pointer;
  }
  .root-remove {
    width: 29px;
    font-size: 18px;
  }
  .root-add-button {
    padding: 0 9px;
    font-size: 12px;
  }
  .root-remove:hover,
  .root-add-button:hover {
    border-color: var(--mdc-theme-primary);
    color: var(--mdc-theme-primary);
  }
  .root-remove:disabled,
  .root-add-button:disabled {
    cursor: default;
    opacity: 0.45;
  }
  .path-input:focus {
    border-color: var(--mdc-theme-primary);
    outline: none;
  }
  .help-item {
    margin-top: 4px;
    color: #24315899;
    font-size: 11px;
    line-height: 1.4;
  }
</style>
