import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { HierarchicalTrackSelectorModel } from '@jbrowse/plugin-data-management'

const ConfirmDialog = lazy(() => import('./ConfirmDialog'))

export default function (pm: PluginManager) {
  pm.addToExtensionPoint('TrackSelector-multiTrackMenuItems', () => {
    return [
      {
        label: 'Create multi-wiggle track',
        onClick: (model: HierarchicalTrackSelectorModel) => {
          const tracks = model.selection
          const trackIds = tracks.map(c => readConfObject(c, 'name'))
          function makeTrack(arg: { name: string }) {
            const subadapters = tracks
              .map(c => readConfObject(c, 'adapter'))
              .map((c, idx) => ({ ...c, source: trackIds[idx] }))
            const assemblyNames = [
              ...new Set(
                tracks.map(c => readConfObject(c, 'assemblyNames')).flat(),
              ),
            ]
            const now = +Date.now()
            const trackId = `multitrack-${now}-sessionTrack`

            getSession(model).addTrackConf({
              type: 'MultiQuantitativeTrack',
              trackId,
              name: arg.name,
              assemblyNames,
              adapter: {
                type: 'MultiWiggleAdapter',
                subadapters,
              },
            })
            model.view.showTrack(trackId)
          }
          getSession(model).queueDialog(handleClose => [
            ConfirmDialog,
            {
              tracks,
              onClose: (arg: boolean, arg1: { name: string }) => {
                if (arg) {
                  makeTrack(arg1)
                }
                handleClose()
              },
            },
          ])
        },
      },
    ]
  })
}