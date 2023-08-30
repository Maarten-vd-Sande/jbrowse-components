/* eslint-disable @typescript-eslint/no-explicit-any */
import { readConfObject } from '../configuration'
import { isElectron } from '../util'

type AnalyticsObj = Record<string, any>

interface Track {
  type: string
}

export async function writeAWSAnalytics(
  rootModel: any,
  initialTimeStamp: number,
  sessionQuery?: string | null,
) {
  try {
    const url = 'https://analytics.jbrowse.org/api/v1'

    const multiAssemblyTracks = rootModel.jbrowse.tracks.filter(
      (track: any) => (readConfObject(track, 'assemblyNames') || []).length > 1,
    ).length

    const savedSessionCount = Object.keys(localStorage).filter(name =>
      name.includes('localSaved-'),
    ).length

    const { jbrowse: config, session, version: ver } = rootModel
    const { tracks, assemblies, plugins } = config

    // stats to be recorded in db
    const stats: AnalyticsObj = {
      ver,
      'plugins-count': plugins?.length || 0,
      'plugin-names': plugins?.map((p: any) => p.name).join(','),
      'assemblies-count': assemblies.length,
      'tracks-count': tracks.length,
      'session-tracks-count': session?.sessionTracks.length || 0,
      'open-views': session?.views.length || 0,
      'synteny-tracks-count': multiAssemblyTracks,
      'saved-sessions-count': savedSessionCount,

      // field if existing session param in query before autogenerated param
      'existing-session-param-type': sessionQuery?.split('-')[0] || 'none',

      // screen geometry
      'scn-h': window.screen.height,
      'scn-w': window.screen.width,

      // window geometry
      'win-h': window.innerHeight,
      'win-w': window.innerWidth,

      electron: isElectron,
      loadTime: (Date.now() - initialTimeStamp) / 1000,
      jb2: true,
    }

    // stringifies the track type counts, gets processed in lambda
    tracks.forEach((track: Track) => {
      const key = `track-types-${track.type}`
      stats[key] = stats[key] + 1 || 1
    })

    // stringifies the session track type counts, gets processed in lambda
    session?.sessionTracks.forEach((track: Track) => {
      const key = `sessionTrack-types-${track.type}`
      stats[key] = stats[key] + 1 || 1
    })

    // put stats into a query string for get request
    const qs = Object.keys(stats)
      .map(key => `${key}=${stats[key]}`)
      .join('&')

    await fetch(`${url}?${qs}`)
  } catch (e) {
    console.error('Failed to write analytics to AWS.', e)
  }
}

export async function writeGAAnalytics(
  rootModel: any,
  initialTimestamp: number,
) {
  const jbrowseUser = 'UA-7115575-5'
  const stats: AnalyticsObj = {
    'tracks-count': rootModel.jbrowse.tracks.length, // this is all possible tracks
    ver: rootModel.version,
    electron: isElectron,
    loadTime: Date.now() - initialTimestamp,
    pluginNames:
      rootModel.jbrowse.plugins?.map((plugin: any) => plugin.name) || '',
  }

  // create script
  let analyticsScript =
    "(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){"
  analyticsScript +=
    '(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),'
  analyticsScript +=
    'm=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)'
  analyticsScript +=
    "})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');"
  analyticsScript += `ga('create', '${jbrowseUser}', 'auto', 'jbrowseTracker');`

  const gaData: AnalyticsObj = {}
  const googleDimensions = 'tracks-count ver electron loadTime pluginNames'

  googleDimensions.split(/\s+/).forEach((key, index) => {
    gaData[`dimension${index + 1}`] = stats[key]
  })

  gaData.metric1 = Math.round(stats.loadTime)

  analyticsScript += `ga('jbrowseTracker.send', 'pageview',${JSON.stringify(
    gaData,
  )});`

  const analyticsScriptNode = document.createElement('script')
  analyticsScriptNode.innerHTML = analyticsScript

  document.getElementsByTagName('head')[0].append(analyticsScriptNode)
}

export function doAnalytics(
  rootModel: any,
  initialTimestamp: number,
  initialSessionQuery: string | null | undefined,
) {
  if (
    rootModel &&
    !readConfObject(rootModel.jbrowse.configuration, 'disableAnalytics')
  ) {
    // ok if these are unhandled
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    writeAWSAnalytics(rootModel, initialTimestamp, initialSessionQuery)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    writeGAAnalytics(rootModel, initialTimestamp)
  }
}
