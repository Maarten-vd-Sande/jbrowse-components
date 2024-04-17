import configSchema from './configSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

export default function HtsgetBamAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'HtsgetBamAdapter',
      displayName: 'Htsget BAM adapter',
      adapterMetadata: {
        hiddenFromGUI: true,
      },
      configSchema,
      getAdapterClass: () => import('./HtsgetBamAdapter').then(r => r.default),
    })
  })
}
