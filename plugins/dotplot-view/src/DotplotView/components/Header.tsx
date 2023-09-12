import React from 'react'
import { IconButton, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { getBpDisplayStr } from '@jbrowse/core/util'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'

// icons
import ZoomOut from '@mui/icons-material/ZoomOut'
import ZoomIn from '@mui/icons-material/ZoomIn'
import MoreVert from '@mui/icons-material/MoreVert'
import { CursorMouse, CursorMove } from './CursorIcon'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

// locals
import { DotplotViewModel } from '../model'
import DotplotWarnings from './DotplotWarnings'
import PanButtons from './PanButtons'

const useStyles = makeStyles()({
  bp: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 10,
  },
  spacer: {
    flexGrow: 1,
  },
  headerBar: {
    display: 'flex',
    position: 'relative',
  },
})

const DotplotControls = observer(({ model }: { model: DotplotViewModel }) => {
  return (
    <div>
      <IconButton onClick={model.zoomOutButton}>
        <ZoomOut />
      </IconButton>

      <IconButton onClick={model.zoomInButton}>
        <ZoomIn />
      </IconButton>

      <IconButton
        onClick={() => model.activateTrackSelector()}
        title="Open track selector"
      >
        <TrackSelectorIcon />
      </IconButton>

      <CascadingMenuButton
        menuItems={[
          {
            onClick: () => model.squareView(),
            label: 'Square view - same base pairs per pixel',
          },
          {
            onClick: () => model.squareViewProportional(),
            label: 'Rectanglularize view - same total bp',
          },
          {
            onClick: () => model.showAllRegions(),
            label: 'Show all regions',
          },
          {
            onClick: () => model.setDrawCigar(!model.drawCigar),
            type: 'checkbox',
            label: 'Draw CIGAR',
            checked: model.drawCigar,
          },
          {
            onClick: () => model.setShowPanButtons(!model.showPanButtons),
            label: 'Show pan buttons',
            type: 'checkbox',
            checked: model.showPanButtons,
          },
          {
            label: 'Click and drag mode',
            subMenu: [
              {
                onClick: () => model.setCursorMode('move'),
                label: 'Pan by default, select region when ctrl key is held',
                icon: CursorMove,
                type: 'radio',
                checked: model.cursorMode === 'move',
              },
              {
                onClick: () => model.setCursorMode('crosshair'),
                label: 'Select region by default, pan when ctrl key is held',
                icon: CursorMouse,
                type: 'radio',
                checked: model.cursorMode === 'crosshair',
              },
            ],
          },
          {
            label: 'Wheel scroll mode',
            subMenu: [
              {
                onClick: () => model.setWheelMode('pan'),
                label: 'Pans view',
                type: 'radio',
                checked: model.wheelMode === 'pan',
              },
              {
                onClick: () => model.setWheelMode('zoom'),
                label: 'Zooms view',
                type: 'radio',
                checked: model.wheelMode === 'zoom',
              },
              {
                onClick: () => model.setWheelMode('none'),
                label: 'Disable',
                type: 'radio',
                checked: model.wheelMode === 'none',
              },
            ],
          },
        ]}
      >
        <MoreVert />
      </CascadingMenuButton>
    </div>
  )
})

export default observer(function Header({
  model,
  selection,
}: {
  model: DotplotViewModel
  selection?: { width: number; height: number }
}) {
  const { classes } = useStyles()
  const { hview, vview, showPanButtons } = model
  return (
    <div className={classes.headerBar}>
      <DotplotControls model={model} />
      <Typography className={classes.bp} variant="body2" color="textSecondary">
        x: {hview.assemblyNames.join(',')} {getBpDisplayStr(hview.currBp)}
        <br />
        y: {vview.assemblyNames.join(',')} {getBpDisplayStr(vview.currBp)}
      </Typography>
      {selection ? (
        <Typography
          className={classes.bp}
          variant="body2"
          color="textSecondary"
        >
          {`width:${getBpDisplayStr(hview.bpPerPx * selection.width)}`} <br />
          {`height:${getBpDisplayStr(vview.bpPerPx * selection.height)}`}
        </Typography>
      ) : null}
      <div className={classes.spacer} />
      <DotplotWarnings model={model} />
      {showPanButtons ? <PanButtons model={model} /> : null}
    </div>
  )
})
