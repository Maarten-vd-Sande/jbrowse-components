import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MCScanSimpleAnchorsAdapter',
        displayName: 'MCScan anchors.simple adapter',
        configSchema,
        adapterMetadata: {
          category: null,
          hiddenFromGUI: true,
          displayName: null,
          description: null,
        },
        getAdapterClass: () =>
          import('./MCScanSimpleAnchorsAdapter').then(r => r.default),
      }),
  )
}
