import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel } from '@jbrowse/core/util'
import { DotplotViewModel } from './DotplotView/model'
import { transaction } from 'mobx'

export default function LaunchDotplotView(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'LaunchView-DotplotView',
    // @ts-expect-error
    async ({
      session,
      views,
      tracks = [],
    }: {
      session: AbstractSessionModel
      views: { loc: string; assembly: string; tracks?: string[] }[]
      tracks?: string[]
    }) => {
      try {
        const model = session.addView('DotplotView', {}) as DotplotViewModel
        const assemblyNames = views.map(view => view.assembly)

        transaction(() => {
          model.setViews([
            { bpPerPx: 0.1, offsetPx: 0 },
            { bpPerPx: 0.1, offsetPx: 0 },
          ])
          model.setAssemblyNames(assemblyNames[0], assemblyNames[1])
        })

        // http://localhost:3000/?config=test_data%2Fvolvox%2Fconfig.json&session=spec-{"views":[{"type":"DotplotView","views":[{"assembly":"volvox"},{"assembly":"volvox"}],"tracks":["volvox_fake_synteny"]}]}

        const idsNotFound = [] as string[]
        tracks.forEach(track => tryTrack(model, track, idsNotFound))

        if (idsNotFound.length) {
          throw new Error(
            `Could not resolve identifiers: ${idsNotFound.join(',')}`,
          )
        }
      } catch (e) {
        session.notify(`${e}`, 'error')
        throw e
      }
    },
  )
}

function tryTrack(
  model: { showTrack: (arg: string) => void },
  trackId: string,
  idsNotFound: string[],
) {
  try {
    model.showTrack(trackId)
  } catch (e) {
    if (`${e}`.match('Could not resolve identifier')) {
      idsNotFound.push(trackId)
    } else {
      throw e
    }
  }
}
