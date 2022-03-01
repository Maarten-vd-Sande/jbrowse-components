import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import AdapterClass from './DeltaAdapter'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'DeltaAdapter',
        configSchema,
        adapterMetadata: {
          category: null,
          hiddenFromGUI: true,
          displayName: null,
          description: null,
        },
        AdapterClass,
      }),
  )
}
