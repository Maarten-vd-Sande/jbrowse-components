/* eslint-disable @typescript-eslint/no-explicit-any,react/no-danger */
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getConf } from '@jbrowse/core/configuration'
import { MenuItem } from '@jbrowse/core/ui'
import {
  isAbortException,
  getContainingView,
  getSession,
  isSelectionContainer,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { BaseFeatureStats } from '@jbrowse/core/util/stats'
import { BaseBlock } from '@jbrowse/core/util/blockTypes'
import { Region } from '@jbrowse/core/util/types'
import CompositeMap from '@jbrowse/core/util/compositeMap'
import { Feature, isFeature } from '@jbrowse/core/util/simpleFeature'
import {
  getParentRenderProps,
  getRpcSessionId,
} from '@jbrowse/core/util/tracks'
import Button from '@material-ui/core/Button'
import Typography from '@material-ui/core/Typography'
import MenuOpenIcon from '@material-ui/icons/MenuOpen'
import { autorun, observable } from 'mobx'
import { addDisposer, Instance, isAlive, types } from 'mobx-state-tree'
import React from 'react'
import { Tooltip } from '../components/BaseLinearDisplay'
import BlockState, { renderBlockData } from './serverSideRenderedBlock'

import { LinearGenomeViewModel, ExportSvgOptions } from '../../LinearGenomeView'

type LGV = LinearGenomeViewModel

export interface Layout {
  minX: number
  minY: number
  maxX: number
  maxY: number
  name: string
}
type LayoutRecord = [number, number, number, number]

const minDisplayHeight = 20
const defaultDisplayHeight = 100
export const BaseLinearDisplay = types
  .compose(
    'BaseLinearDisplay',
    BaseDisplay,
    types.model({
      height: types.optional(
        types.refinement(
          'displayHeight',
          types.number,
          n => n >= minDisplayHeight,
        ),
        defaultDisplayHeight,
      ),
      blockState: types.map(BlockState),
      userFeatureScreenDensity: types.maybe(types.number),
    }),
  )
  .volatile(() => ({
    message: '',
    featureIdUnderMouse: undefined as undefined | string,
    contextMenuFeature: undefined as undefined | Feature,
    scrollTop: 0,
    globalStats: observable({
      featureDensity: 0,
    } as BaseFeatureStats),
    statsStatus: 'none' as 'none' | 'loading' | 'loaded' | 'error',
  }))
  .views(self => ({
    get blockType(): 'staticBlocks' | 'dynamicBlocks' {
      return 'staticBlocks'
    },
    get blockDefinitions() {
      const { blockType } = this
      const view = getContainingView(self) as LinearGenomeViewModel
      if (!view.initialized) {
        throw new Error('view not initialized yet')
      }
      return view[blockType]
    },
  }))
  .views(self => ({
    /**
     * set limit to config amount, or user amount if they force load,
     */

    get maxFeatureScreenDensity() {
      return (
        self.userFeatureScreenDensity ||
        getConf(self, 'maxFeatureScreenDensity')
      )
    },

    /**
     * how many milliseconds to wait for the display to
     * "settle" before re-rendering a block
     */
    get renderDelay() {
      return 50
    },

    get TooltipComponent(): React.FC<any> {
      return Tooltip as unknown as React.FC
    },

    /**
     * returns a string feature ID if the globally-selected object
     * is probably a feature
     */
    get selectedFeatureId() {
      if (isAlive(self)) {
        const { selection } = getSession(self)
        // does it quack like a feature?
        if (isFeature(selection)) {
          return selection.id()
        }
      }
      return undefined
    },
    /**
     * if a display-level message should be displayed instead of the blocks,
     * make this return a react component
     */
    get DisplayMessageComponent() {
      return undefined as undefined | React.FC<any>
    },
  }))
  .views(self => {
    return {
      /**
       * a CompositeMap of `featureId -> feature obj` that
       * just looks in all the block data for that feature
       */
      get features() {
        const featureMaps = []
        for (const block of self.blockState.values()) {
          if (block && block.features) {
            featureMaps.push(block.features)
          }
        }
        return new CompositeMap<string, Feature>(featureMaps)
      },

      get featureUnderMouse() {
        return self.featureIdUnderMouse
          ? this.features.get(self.featureIdUnderMouse)
          : undefined
      },

      getFeatureOverlapping(blockKey: string, x: number, y: number) {
        return self.blockState.get(blockKey)?.layout?.getByCoord(x, y)
      },

      getFeatureByID(blockKey: string, id: string): LayoutRecord | undefined {
        return self.blockState.get(blockKey)?.layout?.getByID(id)
      },

      // if block key is not supplied, can look at all blocks
      searchFeatureByID(id: string): LayoutRecord | undefined {
        let ret
        self.blockState.forEach(block => {
          const val = block?.layout?.getByID(id)
          if (val) {
            ret = val
          }
        })
        return ret
      },
    }
  })
  .actions(self => ({
    // base display reload does nothing, see specialized displays for details
    setMessage(message: string) {
      self.message = message
    },
    setStatsStatus(state: 'none' | 'loading' | 'loaded' | 'error') {
      self.statsStatus = state
    },
    afterAttach() {
      // watch the parent's blocks to update our block state when they change
      const blockWatchDisposer = autorun(() => {
        // create any blocks that we need to create
        const blocksPresent: { [key: string]: boolean } = {}
        const view = getContainingView(self) as LinearGenomeViewModel
        if (view.initialized) {
          self.blockDefinitions.contentBlocks.forEach(block => {
            blocksPresent[block.key] = true
            if (!self.blockState.has(block.key)) {
              this.addBlock(block.key, block)
            }
          })
          // delete any blocks we need go delete
          self.blockState.forEach((_, key) => {
            if (!blocksPresent[key]) {
              this.deleteBlock(key)
            }
          })
        }
      })

      addDisposer(self, blockWatchDisposer)
    },
    async getGlobalStats(
      region: Region,
      opts: {
        headers?: Record<string, string>
        signal?: AbortSignal
        filters?: string[]
      },
    ): Promise<BaseFeatureStats> {
      const { rpcManager } = getSession(self)
      const { adapterConfig } = self
      const sessionId = getRpcSessionId(self)

      const params = {
        sessionId,
        regions: [region],
        adapterConfig,
        statusCallback: (message: string) => {
          if (isAlive(self)) {
            this.setMessage(message)
          }
        },
        ...opts,
      }

      this.setStatsStatus('loading')
      return rpcManager.call(
        sessionId,
        'CoreGetGlobalStats',
        params,
      ) as Promise<BaseFeatureStats>
    },
    updateGlobalStats(stats: BaseFeatureStats) {
      self.globalStats.featureDensity = stats.featureDensity
      this.setStatsStatus('loaded')
    },
    setHeight(displayHeight: number) {
      if (displayHeight > minDisplayHeight) {
        self.height = displayHeight
      } else {
        self.height = minDisplayHeight
      }
      return self.height
    },
    resizeHeight(distance: number) {
      const oldHeight = self.height
      const newHeight = this.setHeight(self.height + distance)
      return newHeight - oldHeight
    },
    setScrollTop(scrollTop: number) {
      self.scrollTop = scrollTop
    },
    setUserFeatureScreenDensity(limit: number) {
      self.userFeatureScreenDensity = limit
    },
    addBlock(key: string, block: BaseBlock) {
      self.blockState.set(
        key,
        BlockState.create({
          key,
          region: block.toRegion(),
        }),
      )
    },
    deleteBlock(key: string) {
      self.blockState.delete(key)
    },
    selectFeature(feature: Feature) {
      const session = getSession(self)
      if (isSessionModelWithWidgets(session)) {
        const featureWidget = session.addWidget(
          'BaseFeatureWidget',
          'baseFeature',
          { featureData: feature.toJSON(), view: getContainingView(self) },
        )
        session.showWidget(featureWidget)
      }
      if (isSelectionContainer(session)) {
        session.setSelection(feature)
      }
    },
    clearFeatureSelection() {
      const session = getSession(self)
      session.clearSelection()
    },
    setFeatureIdUnderMouse(feature: string | undefined) {
      self.featureIdUnderMouse = feature
    },
    reload() {
      ;[...self.blockState.values()].map(val => val.doReload())
    },
    setContextMenuFeature(feature?: Feature) {
      self.contextMenuFeature = feature
    },
  }))
  .actions(self => {
    const { reload: superReload } = self

    return {
      async reload() {
        self.setError()
        const aborter = new AbortController()
        const view = getContainingView(self) as LGV
        if (!view.initialized) {
          return
        }

        let stats
        if (view.staticBlocks.contentBlocks[0]) {
          try {
            stats = await self.getGlobalStats(
              view.staticBlocks.contentBlocks[0],
              { signal: aborter.signal },
            )

            if (isAlive(self)) {
              self.updateGlobalStats(stats)
              superReload()
            } else {
              return
            }
          } catch (e) {
            self.setError(e)
            self.setStatsStatus('error')
          }
        }
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(
            async () => {
              try {
                const aborter = new AbortController()
                const view = getContainingView(self) as LGV
                const currentFeatureScreenDensity =
                  self.globalStats?.featureDensity * view?.bpPerPx

                if (!view.initialized) {
                  return
                }

                if (
                  view &&
                  self.globalStats &&
                  currentFeatureScreenDensity > self.maxFeatureScreenDensity
                ) {
                  return
                }

                if (view.staticBlocks.contentBlocks[0]) {
                  const stats = await self.getGlobalStats(
                    view.staticBlocks.contentBlocks[0],
                    {
                      signal: aborter.signal,
                    },
                  )

                  if (isAlive(self)) {
                    self.updateGlobalStats(stats)
                  } else {
                    return
                  }
                }
              } catch (e) {
                if (!isAbortException(e) && isAlive(self)) {
                  console.error(e)
                  self.setError(e)
                  self.setStatsStatus('error')
                }
              }
            },
            { delay: 1000 },
          ),
        )
      },
    }
  })
  .views(self => ({
    regionCannotBeRenderedText(_region: Region) {
      const view = getContainingView(self) as LinearGenomeViewModel
      const currentFeatureScreenDensity =
        self.globalStats?.featureDensity * view?.bpPerPx
      if (self.statsStatus === 'error') {
        return 'Force load to see features'
      }
      if (view && currentFeatureScreenDensity > self.maxFeatureScreenDensity) {
        return 'Force load to see features'
      }
      return ''
    },

    /**
     * @param region -
     * @returns falsy if the region is fine to try rendering. Otherwise,
     *  return a react node + string of text.
     *  string of text describes why it cannot be rendered
     *  react node allows user to force load at current setting
     */
    regionCannotBeRendered(_region: Region) {
      const view = getContainingView(self) as LinearGenomeViewModel

      const currentFeatureScreenDensity =
        self.globalStats?.featureDensity * view?.bpPerPx
      if (
        view &&
        self.globalStats.featureDensity !== undefined &&
        currentFeatureScreenDensity > self.maxFeatureScreenDensity
      ) {
        return (
          <>
            <Typography component="span" variant="body2">
              Zoom in to see features or{' '}
            </Typography>
            <Button
              data-testid="force_reload_button"
              onClick={() => {
                self.setUserFeatureScreenDensity(
                  currentFeatureScreenDensity * 1.05,
                )
              }}
              variant="outlined"
            >
              Force Load
            </Button>
            <Typography component="span" variant="body2">
              (force load may be slow)
            </Typography>
          </>
        )
      }
      return undefined
    },

    trackMenuItems(): MenuItem[] {
      return []
    },

    contextMenuItems() {
      return self.contextMenuFeature
        ? [
            {
              label: 'Open feature details',
              icon: MenuOpenIcon,
              onClick: () => {
                if (self.contextMenuFeature) {
                  self.selectFeature(self.contextMenuFeature)
                }
              },
            },
          ]
        : []
    },
    renderProps() {
      return {
        ...getParentRenderProps(self),
        rpcDriverName: self.rpcDriverName,
        displayModel: self,
        statsNotReady:
          self.statsStatus === 'loading' || self.statsStatus === 'error',
        onFeatureClick(_: unknown, featureId: string | undefined) {
          const f = featureId || self.featureIdUnderMouse
          if (!f) {
            self.clearFeatureSelection()
          } else {
            const feature = self.features.get(f)
            self.selectFeature(feature as Feature)
          }
        },
        onClick() {
          self.clearFeatureSelection()
        },
        // similar to click but opens a menu with further options
        onFeatureContextMenu(_: unknown, featureId: string | undefined) {
          const f = featureId || self.featureIdUnderMouse
          if (!f) {
            self.clearFeatureSelection()
          } else {
            // feature id under mouse passed to context menu
            self.setContextMenuFeature(self.features.get(f))
          }
        },

        onMouseMove(_: unknown, featureId: string | undefined) {
          self.setFeatureIdUnderMouse(featureId)
        },

        onMouseLeave(_: unknown) {
          self.setFeatureIdUnderMouse(undefined)
        },

        onContextMenu() {
          self.setContextMenuFeature(undefined)
          self.clearFeatureSelection()
        },
      }
    },
  }))
  .actions(self => ({
    async renderSvg(opts: ExportSvgOptions & { overrideHeight: number }) {
      const { height, id } = self
      const { overrideHeight } = opts
      const view = getContainingView(self) as LinearGenomeViewModel
      const {
        offsetPx: viewOffsetPx,
        roundedDynamicBlocks: dynamicBlocks,
        width,
      } = view

      const renderings = await Promise.all(
        dynamicBlocks.map(block => {
          const blockState = BlockState.create({
            key: block.key,
            region: block,
          })

          // regionCannotBeRendered can return jsx so look for plaintext
          // version, or just get the default if none available
          const cannotBeRenderedReason =
            self.regionCannotBeRenderedText(block) ||
            self.regionCannotBeRendered(block)

          if (cannotBeRenderedReason) {
            return {
              reactElement: (
                <>
                  <rect x={0} y={0} width={width} height={20} fill="#aaa" />
                  <text x={0} y={15}>
                    {cannotBeRenderedReason}
                  </text>
                </>
              ),
            }
          }

          const { rpcManager, renderArgs, renderProps, rendererType } =
            renderBlockData(blockState, self)

          return rendererType.renderInClient(rpcManager, {
            ...renderArgs,
            ...renderProps,
            exportSVG: opts,
          })
        }),
      )

      return (
        <>
          {renderings.map((rendering, index) => {
            const { offsetPx } = dynamicBlocks[index]
            const offset = offsetPx - viewOffsetPx
            // stabalize clipid under test for snapshot
            const clipid = `clip-${
              typeof jest === 'undefined' ? id : 'jest'
            }-${index}`
            return (
              <React.Fragment key={`frag-${index}`}>
                <defs>
                  <clipPath id={clipid}>
                    <rect
                      x={0}
                      y={0}
                      width={width}
                      height={overrideHeight || height}
                    />
                  </clipPath>
                </defs>
                <g transform={`translate(${offset} 0)`}>
                  <g clipPath={`url(#${clipid})`}>
                    {React.isValidElement(rendering.reactElement) ? (
                      rendering.reactElement
                    ) : (
                      <g dangerouslySetInnerHTML={{ __html: rendering.html }} />
                    )}
                  </g>
                </g>
              </React.Fragment>
            )
          })}
        </>
      )
    },
  }))
  .postProcessSnapshot(self => {
    const { blockState, ...rest } = self
    return rest
  })

export type BaseLinearDisplayStateModel = typeof BaseLinearDisplay
export type BaseLinearDisplayModel = Instance<BaseLinearDisplayStateModel>
