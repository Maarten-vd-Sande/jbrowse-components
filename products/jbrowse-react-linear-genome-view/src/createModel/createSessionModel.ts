/* eslint-disable @typescript-eslint/no-explicit-any */
// note: AboutDialog is imported statically instead of as a lazy component
// due to vite failing to load it xref #2896
import { AbstractSessionModel } from '@jbrowse/core/util/types'
import addSnackbarToModel from '@jbrowse/core/ui/SnackbarModel'
import { readConfObject } from '@jbrowse/core/configuration'
import { cast, getParent, types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import InfoIcon from '@mui/icons-material/Info'
import AboutDialog from '@jbrowse/core/ui/AboutDialog'
import { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'
import { Session as CoreSession } from '@jbrowse/product-core'

// locals

/**
 * #stateModel JBrowseReactLGVSessionModel
 * inherits SnackbarModel
 */
export default function sessionModelFactory(pluginManager: PluginManager) {
  const model = types
    .compose(
      'ReactLinearGenomeViewSession',
      CoreSession.Base(pluginManager),
      CoreSession.DrawerWidgets(pluginManager),
      CoreSession.Connections(pluginManager),
      CoreSession.DialogQueue(pluginManager),
      CoreSession.Tracks(pluginManager),
      CoreSession.ReferenceManagement(pluginManager),
      CoreSession.SessionTracks(pluginManager),
    )
    .props({
      /**
       * #property
       */
      view: pluginManager.getViewType('LinearGenomeView')
        .stateModel as LinearGenomeViewStateModel,
      /**
       * #property
       */
      sessionTracks: types.array(
        pluginManager.pluggableConfigSchemaType('track'),
      ),
    })
    .views(self => ({
      /**
       * #getter
       */
      get disableAddTracks() {
        return getParent<any>(self).disableAddTracks
      },
      /**
       * #getter
       */
      get assemblies() {
        return [getParent<any>(self).config.assembly]
      },
      /**
       * #getter
       */
      get assemblyNames() {
        return [getParent<any>(self).config.assemblyName]
      },
      /**
       * #getter
       */
      get connections() {
        return getParent<any>(self).config.connections
      },
      /**
       * #getter
       */
      get assemblyManager() {
        return getParent<any>(self).assemblyManager
      },
      /**
       * #getter
       */
      get views() {
        return [self.view]
      },
      /**
       * #method
       */
      renderProps() {
        return { theme: readConfObject(self.configuration, 'theme') }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      addView(typeName: string, initialState = {}) {
        const typeDefinition = pluginManager.getElementType('view', typeName)
        if (!typeDefinition) {
          throw new Error(`unknown view type ${typeName}`)
        }

        self.view = cast({
          ...initialState,
          type: typeName,
        })
        return self.view
      },

      removeView() {},
    }))
    .views(self => ({
      /**
       * #method
       */
      getTrackActionMenuItems(config: any) {
        return [
          {
            label: 'About track',
            onClick: () => {
              self.queueDialog(doneCallback => [
                AboutDialog,
                { config, handleClose: doneCallback },
              ])
            },
            icon: InfoIcon,
          },
        ]
      },
    }))

  return addSnackbarToModel(model)
}

export type SessionStateModel = ReturnType<typeof sessionModelFactory>
export type SessionModel = Instance<SessionStateModel>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function z(x: Instance<SessionStateModel>): AbstractSessionModel {
  // this function's sole purpose is to get typescript to check
  // that the session model implements all of AbstractSessionModel
  return x
}
