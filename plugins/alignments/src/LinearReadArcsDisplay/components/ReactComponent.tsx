import React, { useCallback } from 'react'
import { observer } from 'mobx-react'
import { getContainingView } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// local
import { LinearReadArcsDisplayModel } from '../model'
import BaseDisplayComponent from '../../shared/BaseDisplayComponent'

type LGV = LinearGenomeViewModel

const Arcs = observer(function ({
  model,
}: {
  model: LinearReadArcsDisplayModel
}) {
  const view = getContainingView(model) as LGV
  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const height = model.height
  const cb = useCallback(
    (ref: HTMLCanvasElement) => {
      model.setRef(ref)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, width, height],
  )

  // note: the position absolute below avoids scrollbar from appearing on track
  return (
    <canvas
      data-testid="arc-canvas"
      ref={cb}
      style={{ width, height, position: 'absolute' }}
      width={width * 2}
      height={height * 2}
    />
  )
})

const LinearReadArcsReactComponent = observer(function ({
  model,
}: {
  model: LinearReadArcsDisplayModel
}) {
  return (
    <BaseDisplayComponent model={model}>
      <Arcs model={model} />
    </BaseDisplayComponent>
  )
})

export default LinearReadArcsReactComponent
