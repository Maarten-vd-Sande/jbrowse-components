import React from 'react'
import { Badge, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

// icons
import HistoryIcon from '@mui/icons-material/History'

// locals
import { HierarchicalTrackSelectorModel } from '../../model'
import DropdownTrackSelector from './DropdownTrackSelector'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  smallBadge: {
    height: 14,
  },
})

const RecentlyUsedTracks = observer(function ({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const { view, recentlyUsedCounter, recentlyUsedTracks } = model
  return view ? (
    <DropdownTrackSelector
      onClick={() => model.setRecentlyUsedCounter(0)}
      model={model}
      tracks={recentlyUsedTracks}
      extraMenuItems={
        recentlyUsedTracks.length
          ? [
              { type: 'divider' as const },
              {
                label: 'Clear recently used',
                onClick: () => model.clearRecentlyUsed(),
              },
            ]
          : [
              {
                label: 'No recently used',
                onClick: () => {},
              },
            ]
      }
    >
      <Tooltip title="Recently used tracks">
        <Badge
          classes={{ badge: classes.smallBadge }}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          color="secondary"
          badgeContent={recentlyUsedCounter}
        >
          <HistoryIcon />
        </Badge>
      </Tooltip>
    </DropdownTrackSelector>
  ) : null
})

export default RecentlyUsedTracks
