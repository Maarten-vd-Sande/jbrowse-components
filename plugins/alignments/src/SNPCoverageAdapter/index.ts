import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'
import { capabilities } from './SNPCoverageAdapter'

export default function (pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'SNPCoverageAdapter',
      displayName: 'SNPCoverage adapter',
      adapterMetadata: {
        hiddenFromGUI: true,
      },
      getAdapterClass: () =>
        import('./SNPCoverageAdapter').then(r => r.default),
      configSchema,
      adapterCapabilities: capabilities,
    })
  })
}
