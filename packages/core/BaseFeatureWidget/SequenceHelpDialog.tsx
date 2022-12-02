import React from 'react'
import { Button, DialogContent, DialogActions, Typography } from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'

// icons
import SettingsIcon from '@mui/icons-material/Settings'

export default function HelpDialog({
  handleClose,
}: {
  handleClose: () => void
}) {
  return (
    <Dialog
      maxWidth="xl"
      open
      onClose={() => handleClose()}
      title="Feature sequence panel help"
    >
      <DialogContent>
        <Typography paragraph>
          The "Feature sequence" panel shows the underlying genomic sequence for
          a given feature, fetched from the reference genome.
        </Typography>
        <Typography>
          For gene features, this panel does special calculations to e.g. stitch
          together the coding sequence, the options are:
        </Typography>
        <ul>
          <li>CDS - shows the stitched together CDS sequences</li>
          <li>
            Protein - the translated coding sequence, with the "standard"
            genetic code
          </li>
          <li>cDNA - shows the UTRs and stitched together CDS sequences</li>
          <li>
            Gene w/ introns - the sequence underlying the entire gene including
            including introns, with UTR and CDS highlighted
          </li>
          <li>
            Gene w/ Nbp introns - same "Gene w/ introns", but limiting to a
            subset of the intron sequence displayed
          </li>
          <li>
            Gene +/- Nbp up+down stream - same as "Gene w/ introns" but with up
            and downstream sequence displayed
          </li>
          <li>
            Gene +/- Nbp up+down stream, Nbp introns - same as "Gene w/
            introns", but with limited intron sequence displayed and up and
            downstream sequence
          </li>
        </ul>
        <Typography paragraph>
          For other feature types, the options are:
        </Typography>
        <ul>
          <li>
            Feature sequence - the reference genome sequence underlying the
            feature
          </li>
          <li>
            Feature sequence +/- Nbp up+down stream - the reference genome
            sequence underlying the feature, with the up and downstream sequence
          </li>
        </ul>
        <Typography>
          Note: you can use the "gear icon" <SettingsIcon /> to edit the number
          of bp displayed up/downstream and in the intron region
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={() => handleClose()} autoFocus variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
