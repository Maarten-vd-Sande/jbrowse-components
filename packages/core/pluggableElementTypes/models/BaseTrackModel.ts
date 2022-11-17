import { transaction } from 'mobx'
import { getRoot, resolveIdentifier, types, Instance } from 'mobx-state-tree'
import {
  getConf,
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  ConfigurationReference,
} from '../../configuration'
import PluginManager from '../../PluginManager'
import { MenuItem } from '../../ui'
import { getContainingView, getSession } from '../../util'
import { isSessionModelWithConfigEditing } from '../../util/types'
import { ElementId } from '../../util/types/mst'

// these MST models only exist for tracks that are *shown*. they should contain
// only UI state for the track, and have a reference to a track configuration
// (stored under session.configuration.assemblies.get(assemblyName).tracks).

/**
 * #stateModel BaseViewModel
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

// note that multiple displayed tracks could use the same configuration.
export function createBaseTrackModel(
  pm: PluginManager,
  trackType: string,
  baseTrackConfig: AnyConfigurationSchemaType,
) {
  return types
    .model(trackType, {
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
      type: types.literal(trackType),
      /**
       * #property
       */
      configuration: ConfigurationReference(baseTrackConfig),
      /**
       * #property
       */
      displays: types.array(pm.pluggableMstType('display', 'stateModel')),
    })
    .views(self => ({
      /**
       * #getter
       * decides how to assign tracks to rpc, by default uses the trackId
       */
      get rpcSessionId() {
        return self.configuration.trackId
      },
      /**
       * #getter
       */
      get name() {
        return getConf(self, 'name')
      },
      /**
       * #getter
       */
      get textSearchAdapter() {
        return getConf(self, 'textSearchAdapter')
      },

      /**
       * #getter
       */
      get adapterType() {
        const adapterConfig = getConf(self, 'adapter')
        if (!adapterConfig) {
          throw new Error(`no adapter configuration provided for ${self.type}`)
        }
        const adapterType = pm.getAdapterType(adapterConfig.type)
        if (!adapterType) {
          throw new Error(`unknown adapter type ${adapterConfig.type}`)
        }
        return adapterType
      },

      /**
       * #getter
       */
      get viewMenuActions(): MenuItem[] {
        const menuItems: MenuItem[] = []
        self.displays.forEach(display => {
          menuItems.push(...display.viewMenuActions)
        })
        return menuItems
      },

      /**
       * #getter
       */
      get canConfigure() {
        const session = getSession(self)
        return (
          isSessionModelWithConfigEditing(session) &&
          // @ts-ignore
          (session.adminMode ||
            // @ts-ignore
            session.sessionTracks.find(track => {
              return track.trackId === self.configuration.trackId
            }))
        )
      },
    }))
    .actions(self => ({
      /**
       * #actions
       */
      activateConfigurationUI() {
        const session = getSession(self)
        const view = getContainingView(self)
        if (isSessionModelWithConfigEditing(session)) {
          // @ts-ignore
          const trackConf = session.editTrackConfiguration(self.configuration)
          if (trackConf && trackConf !== self.configuration) {
            // @ts-ignore
            view.hideTrack(self.configuration)
            // @ts-ignore
            view.showTrack(trackConf)
          }
        }
      },

      /**
       * #actions
       */
      showDisplay(displayId: string, initialSnapshot = {}) {
        const schema = pm.pluggableConfigSchemaType('display')
        const conf = resolveIdentifier(schema, getRoot(self), displayId)
        const displayType = pm.getDisplayType(conf.type)
        if (!displayType) {
          throw new Error(`unknown display type ${conf.type}`)
        }
        const display = displayType.stateModel.create({
          ...initialSnapshot,
          type: conf.type,
          configuration: conf,
        })
        self.displays.push(display)
      },

      /**
       * #actions
       */
      hideDisplay(displayId: string) {
        const schema = pm.pluggableConfigSchemaType('display')
        const conf = resolveIdentifier(schema, getRoot(self), displayId)
        const t = self.displays.filter(d => d.configuration === conf)
        transaction(() => t.forEach(d => self.displays.remove(d)))
        return t.length
      },

      /**
       * #actions
       */
      replaceDisplay(oldId: string, newId: string, initialSnapshot = {}) {
        const idx = self.displays.findIndex(
          d => d.configuration.displayId === oldId,
        )
        if (idx === -1) {
          throw new Error(`could not find display id ${oldId} to replace`)
        }
        const schema = pm.pluggableConfigSchemaType('display')
        const conf = resolveIdentifier(schema, getRoot(self), newId)
        const displayType = pm.getDisplayType(conf.type)
        if (!displayType) {
          throw new Error(`unknown display type ${conf.type}`)
        }
        self.displays.splice(idx, 1, {
          ...initialSnapshot,
          type: conf.type,
          configuration: conf,
        })
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      trackMenuItems() {
        const menuItems: MenuItem[] = []
        self.displays.forEach(display => {
          menuItems.push(...display.trackMenuItems())
        })
        const displayChoices: MenuItem[] = []
        const view = getContainingView(self)
        const viewType = pm.getViewType(view.type)
        const compatibleDisplayTypes = viewType.displayTypes.map(
          displayType => displayType.name,
        )
        const compatibleDisplays = self.configuration.displays.filter(
          (displayConf: AnyConfigurationModel) =>
            compatibleDisplayTypes.includes(displayConf.type),
        )
        const shownId = self.displays[0].configuration.displayId
        if (compatibleDisplays.length > 1) {
          displayChoices.push(
            { type: 'divider' },
            { type: 'subHeader', label: 'Display types' },
          )
          compatibleDisplays.forEach((displayConf: AnyConfigurationModel) => {
            displayChoices.push({
              type: 'radio',
              label: displayConf.type,
              checked: displayConf.displayId === shownId,
              onClick: () =>
                self.replaceDisplay(shownId, displayConf.displayId),
            })
          })
        }
        return [...menuItems, ...displayChoices]
      },
    }))
}

export type BaseTrackStateModel = ReturnType<typeof createBaseTrackModel>
export type BaseTrackModel = Instance<BaseTrackStateModel>
