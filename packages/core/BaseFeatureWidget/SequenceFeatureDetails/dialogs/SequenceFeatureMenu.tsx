import React, { lazy, useState } from 'react'
import { observer } from 'mobx-react'
import copy from 'copy-to-clipboard'
import { saveAs } from 'file-saver'

// locals
import CascadingMenuButton from '../../../ui/CascadingMenuButton'
import { SequenceFeatureDetailsModel } from '../model'
import { MenuItem } from '../../../ui'

// icons
import MoreVert from '@mui/icons-material/MoreVert'
import Settings from '@mui/icons-material/Settings'

// lazies
const SequenceFeatureSettingsDialog = lazy(() => import('./SettingsDialog'))

interface Props {
  model: SequenceFeatureDetailsModel
  extraItems?: MenuItem[]
  mode: string
}
const SequenceFeatureMenu = observer(
  React.forwardRef<HTMLDivElement, Props>(function SequenceFeatureMenu2(
    { model, extraItems = [], mode },
    ref,
  ) {
    if (typeof ref === 'function') {
      throw new Error('needs a non function ref')
    }
    const [showSettings, setShowSettings] = useState(false)
    const { showCoordinates2 } = model
    const showGenomicCoordsOption =
      mode === 'gene' || mode === 'gene_updownstream'

    return (
      <>
        <CascadingMenuButton
          menuItems={[
            {
              label: 'Copy plaintext',
              onClick: () => {
                const r = ref?.current
                if (r) {
                  copy(r.textContent || '', { format: 'text/plain' })
                }
              },
            },
            {
              label: 'Copy HTML',
              onClick: () => {
                const r = ref?.current
                if (r) {
                  copy(r.outerHTML, { format: 'text/html' })
                }
              },
            },
            {
              label: 'Download plaintext',
              onClick: () => {
                const r = ref?.current
                if (r) {
                  saveAs(
                    new Blob([r.textContent || ''], {
                      type: 'text/plain;charset=utf-8',
                    }),
                    'sequence.txt',
                  )
                }
              },
            },
            {
              label: 'Download HTML',
              onClick: () => {
                const r = ref?.current
                if (r) {
                  saveAs(
                    new Blob([r.outerHTML || ''], {
                      type: 'text/html;charset=utf-8',
                    }),
                    'sequence.html',
                  )
                }
              },
            },

            ...extraItems,

            {
              label: 'Show coordinates?',
              type: 'subMenu',
              subMenu: [
                {
                  label: 'No coordinates',
                  type: 'radio',
                  checked: showCoordinates2 === 'none',
                  onClick: () => model.setShowCoordinates('none'),
                },
                {
                  label: 'Coordinates relative to feature start',
                  type: 'radio',
                  checked:
                    // make relative selected if the user selected genomic but
                    // that option isn't available
                    showCoordinates2 === 'relative' ||
                    (showCoordinates2 == 'genomic' && !showGenomicCoordsOption),
                  onClick: () => model.setShowCoordinates('relative'),
                },
                ...(showGenomicCoordsOption
                  ? [
                      {
                        label:
                          'Coordinates relative to genome (only available for continuous genome based sequence types)',
                        type: 'radio' as const,
                        checked: showCoordinates2 === 'genomic',
                        onClick: () => model.setShowCoordinates('genomic'),
                      },
                    ]
                  : []),
              ],
            },
            {
              label: 'Settings',
              icon: Settings,
              onClick: () => setShowSettings(true),
            },
          ]}
        >
          <MoreVert />
        </CascadingMenuButton>

        {showSettings ? (
          <SequenceFeatureSettingsDialog
            model={model}
            handleClose={() => setShowSettings(false)}
          />
        ) : null}
      </>
    )
  }),
)

export default SequenceFeatureMenu
