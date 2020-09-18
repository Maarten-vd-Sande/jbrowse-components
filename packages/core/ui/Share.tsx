import React from 'react'
import Button from '@material-ui/core/Button'
import ShareIcon from '@material-ui/icons/Share'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import { getSnapshot } from 'mobx-state-tree'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import Divider from '@material-ui/core/Divider'
import TextField from '@material-ui/core/TextField'
import copy from 'copy-to-clipboard'
import { fade } from '@material-ui/core/styles/colorManipulator'
import { ContentCopy as ContentCopyIcon } from './Icons'
import { toUrlSafeB64 } from '../util'

// TODO SESSION remove all references to useUrlSession
const useStyles = makeStyles(theme => ({
  shareDiv: {
    textAlign: 'center',
    paddingLeft: '2px',
  },
  shareButton: {
    '&:hover': {
      backgroundColor: fade(
        theme.palette.primary.contrastText,
        theme.palette.action.hoverOpacity,
      ),
      '@media (hover: none)': {
        backgroundColor: 'transparent',
      },
    },
  },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Share = observer((props: { session: any }) => {
  const { session } = props
  const classes = useStyles()
  const url =
    'https://g5um1mrb0i.execute-api.us-east-1.amazonaws.com/api/v1/share'

  const [open, setOpen] = React.useState(false)
  const [shareUrl, setShareUrl] = React.useState('')
  const locationUrl = new URL(window.location.href)

  const localHostMessage = locationUrl.href.includes('localhost')
    ? 'Warning: Domain contains localhost, sharing link with others may be unsuccessful'
    : ''

  const handleClickOpen = (urlLink: string) => {
    const params = new URLSearchParams(locationUrl.search)

    params.set('session', `share-${urlLink}`)
    locationUrl.search = params.toString()
    setShareUrl(locationUrl.href)
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
  }

  const shareSessionToDynamo = async () => {
    const sess = `${toUrlSafeB64(JSON.stringify(getSnapshot(session)))}`

    const data = new FormData()
    data.append('session', sess)

    let response
    try {
      response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        body: data,
      })
    } catch (error) {
      // ignore
    }

    if (response && response.ok) {
      const json = await response.json()
      handleClickOpen(json.sessionId)
    } else {
      // on fail, say failed to generate sharelink
    }
  }
  return (
    <div className={classes.shareDiv}>
      <Button
        data-testid="share_button"
        onClick={() => {
          shareSessionToDynamo()
        }}
        size="small"
        color="inherit"
        startIcon={<ShareIcon />}
        classes={{ root: classes.shareButton }}
      >
        Share
      </Button>
      <Dialog
        maxWidth="xl"
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          JBrowse Shareable Link
        </DialogTitle>
        <Divider />
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Share the below URL to let others see what you see on screen.
            <br />
            {localHostMessage}
          </DialogContentText>
        </DialogContent>
        <DialogContent>
          {/* <DialogContentText id="alert-dialog-description">
            {shareUrl}
          </DialogContentText> */}
          <TextField
            id="filled-read-only-input"
            label="URL"
            defaultValue={shareUrl}
            InputProps={{
              readOnly: true,
            }}
            variant="filled"
            style={{ width: '100%' }}
            onClick={event => {
              const target = event.target as HTMLTextAreaElement
              target.select()
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              copy(shareUrl)
              session.notify('Copied to clipboard', 'success')
            }}
            color="primary"
            startIcon={<ContentCopyIcon />}
          >
            Copy to Clipboard
          </Button>
          <Button onClick={handleClose} color="primary" autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
})

export default Share
