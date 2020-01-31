import { getSession } from '@gmod/jbrowse-core/util'
import { IRegion } from '@gmod/jbrowse-core/mst-types'

// material ui things
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import Checkbox from '@material-ui/core/Checkbox'
import Container from '@material-ui/core/Container'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import Grid from '@material-ui/core/Grid'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import InputBase from '@material-ui/core/InputBase'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import Paper from '@material-ui/core/Paper'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'

// misc
import clsx from 'clsx'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import ReactPropTypes from 'prop-types'
import React, { useState } from 'react'

// locals
import buttonStyles from './buttonStyles'
import RefNameAutocomplete from './RefNameAutocomplete'
import Rubberband from './Rubberband'
import TrackContainer from './TrackContainer'
import ScaleBar from './ScaleBar'
import ZoomControls from './ZoomControls'
import {
  LinearGenomeViewStateModel,
  HEADER_BAR_HEIGHT,
  SCALE_BAR_HEIGHT,
} from '..'

type LGV = Instance<LinearGenomeViewStateModel>

const useStyles = makeStyles(theme => ({
  root: {
    position: 'relative',
    marginBottom: theme.spacing(1),
    overflow: 'hidden',
    background: '#D9D9D9',
    // background: theme.palette.background.paper,
    boxSizing: 'content-box',
  },
  controls: {
    borderRight: '1px solid gray',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  viewControls: {
    height: '100%',
    zIndex: 10,
    background: '#D9D9D9',
    borderBottom: '1px solid #9e9e9e',
    boxSizing: 'border-box',
  },
  headerBar: {
    height: HEADER_BAR_HEIGHT,
    display: 'flex',
    background: '#F2F2F2',
    borderTop: '1px solid #9D9D9D',
    borderBottom: '1px solid #9D9D9D',
  },
  spacer: {
    flexGrow: 1,
  },
  navbox: {
    margin: theme.spacing(1),
  },
  emphasis: {
    background: theme.palette.secondary.main,
    padding: theme.spacing(1),
  },
  searchRoot: {
    margin: theme.spacing(1),
    alignItems: 'center',
  },
  viewName: {
    margin: theme.spacing(0.25),
  },
  zoomControls: {
    position: 'absolute',
    top: 0,
  },
  hovered: {
    background: theme.palette.secondary.light,
  },
  input: {
    width: 300,
    error: {
      backgroundColor: 'red',
    },
    padding: theme.spacing(0, 1),
  },
  importFormContainer: {
    marginBottom: theme.spacing(4),
  },
  importFormEntry: {
    minWidth: 180,
  },
  headerRefName: {
    minWidth: 140,
    margin: theme.spacing(0.5),
    background: theme.palette.background.default,
  },
  noTracksMessage: {
    background: theme.palette.background.default,
    textAlign: 'center',
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  ...buttonStyles(theme),
}))

const LongMenu = observer(
  ({ model, className }: { model: LGV; className: string }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
    const open = Boolean(anchorEl)

    function handleClick(event: React.MouseEvent<HTMLElement>) {
      setAnchorEl(event.currentTarget)
    }

    function handleClose() {
      setAnchorEl(null)
    }

    return (
      <>
        <IconButton
          aria-label="more"
          aria-controls="long-menu"
          aria-haspopup="true"
          className={className}
          onClick={handleClick}
          color="secondary"
        >
          <Icon>more_vert</Icon>
        </IconButton>
        <Menu
          id="long-menu"
          anchorEl={anchorEl}
          keepMounted
          open={open}
          onClose={handleClose}
        >
          {model.menuOptions.map(option => {
            return option.isCheckbox ? (
              <MenuItem key={option.key}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={option.checked}
                      onChange={() => {
                        option.callback()
                        handleClose()
                      }}
                    />
                  }
                  label={option.title}
                />
              </MenuItem>
            ) : (
              <MenuItem
                key={option.key}
                onClick={() => {
                  option.callback()
                  handleClose()
                }}
              >
                {option.title}
              </MenuItem>
            )
          })}
        </Menu>
      </>
    )
  },
)

const TextFieldOrTypography = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()
  const name = model.displayName
  const [edit, setEdit] = useState(false)
  const [hover, setHover] = useState(false)
  return edit ? (
    <form
      onSubmit={event => {
        setEdit(false)
        event.preventDefault()
      }}
    >
      <TextField
        value={name}
        onChange={event => {
          model.setDisplayName(event.target.value)
        }}
        onBlur={() => {
          setEdit(false)
          model.setDisplayName(name || '')
        }}
      />
    </form>
  ) : (
    <div className={clsx(classes.emphasis, hover ? classes.hovered : null)}>
      <Typography
        className={classes.viewName}
        onClick={() => setEdit(true)}
        onMouseOver={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ color: '#FFFFFF' }}
      >
        {name}
      </Typography>
    </div>
  )
})

function Search({
  onSubmit,
  error,
}: {
  onSubmit: Function
  error: string | undefined
}) {
  const [value, setValue] = useState<string | undefined>()
  const classes = useStyles()
  const placeholder = 'Enter location (e.g. chr1:1000..5000)'

  return (
    <Paper className={classes.searchRoot}>
      <form
        onSubmit={event => {
          onSubmit(value)
          event.preventDefault()
        }}
      >
        <InputBase
          className={classes.input}
          error={!!error}
          onChange={event => setValue(event.target.value)}
          placeholder={placeholder}
        />
        <IconButton
          onClick={() => onSubmit(value)}
          className={classes.iconButton}
          aria-label="search"
          color="secondary"
        >
          <Icon>search</Icon>
        </IconButton>
      </form>
    </Paper>
  )
}
Search.propTypes = {
  onSubmit: ReactPropTypes.func.isRequired,
  error: ReactPropTypes.string, // eslint-disable-line react/require-default-props
}

const Header = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()

  function setDisplayedRegions(region: IRegion | undefined) {
    if (region) {
      model.setDisplayedRegions([region])
    }
  }

  return (
    <div className={classes.headerBar}>
      <Controls model={model} />
      <TextFieldOrTypography model={model} />
      <div className={classes.spacer} />

      <Search onSubmit={model.navToLocstring} error={''} />
      <RefNameAutocomplete
        model={model}
        onSelect={setDisplayedRegions}
        assemblyName={model.displayedRegions[0].assemblyName}
        defaultRegionName={model.displayedRegions[0].refName}
        TextFieldProps={{
          variant: 'outlined',
          margin: 'none',
          className: classes.headerRefName,
          InputProps: {
            style: {
              paddingTop: 2,
              paddingBottom: 2,
            },
          },
        }}
      />

      <ZoomControls model={model} />
      <div className={classes.spacer} />
    </div>
  )
})

const Controls = observer(({ model }) => {
  const classes = useStyles()
  return (
    <>
      <IconButton
        onClick={model.closeView}
        className={classes.iconButton}
        title="close this view"
        color="secondary"
      >
        <Icon fontSize="small">close</Icon>
      </IconButton>

      <IconButton
        onClick={model.activateTrackSelector}
        title="select tracks"
        value="track_select"
        color="secondary"
      >
        <Icon fontSize="small">line_style</Icon>
      </IconButton>
      <LongMenu className={classes.iconButton} model={model} />
    </>
  )
})

const ImportForm = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()
  const [selectedAssemblyIdx, setSelectedAssemblyIdx] = useState(0)
  const [selectedRegion, setSelectedRegion] = useState<IRegion | undefined>()
  const [error, setError] = useState('')
  const {
    assemblyNames,
  }: {
    assemblyNames: string[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = getSession(model) as any
  if (!error && !assemblyNames.length) {
    setError('No configured assemblies')
  }

  function onAssemblyChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setSelectedAssemblyIdx(Number(event.target.value))
  }

  function onOpenClick() {
    if (selectedRegion) {
      model.setDisplayedRegions([selectedRegion])
      model.setDisplayName(selectedRegion.assemblyName)
    }
  }

  return (
    <>
      {model.hideCloseButton ? null : (
        <div style={{ height: 40 }}>
          <IconButton
            onClick={model.closeView}
            className={classes.iconButton}
            title="close this view"
            color="secondary"
          >
            <Icon>close</Icon>
          </IconButton>
        </div>
      )}
      <Container className={classes.importFormContainer}>
        <Grid container spacing={1} justify="center" alignItems="center">
          <Grid item>
            <TextField
              select
              variant="outlined"
              value={
                assemblyNames[selectedAssemblyIdx] && !error
                  ? selectedAssemblyIdx
                  : ''
              }
              onChange={onAssemblyChange}
              label="Assembly"
              helperText={error || 'Select assembly to view'}
              error={!!error}
              disabled={!!error}
              margin="normal"
              className={classes.importFormEntry}
            >
              {assemblyNames.map((name, idx) => (
                <MenuItem key={name} value={idx}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item>
            <RefNameAutocomplete
              model={model}
              assemblyName={
                error ? undefined : assemblyNames[selectedAssemblyIdx]
              }
              onSelect={setSelectedRegion}
              TextFieldProps={{
                margin: 'normal',
                variant: 'outlined',
                label: 'Sequence',
                className: classes.importFormEntry,
                helperText: 'Select sequence to view',
              }}
            />
          </Grid>
          <Grid item>
            <Button
              disabled={!selectedRegion}
              onClick={onOpenClick}
              variant="contained"
              color="primary"
            >
              Open
            </Button>
          </Grid>
        </Grid>
      </Container>
    </>
  )
})

const LinearGenomeView = observer((props: { model: LGV }) => {
  const { model } = props
  const { tracks, error } = model
  const classes = useStyles()

  const initialized = !!model.displayedRegions.length
  return (
    <div className={classes.root}>
      {!initialized ? (
        <ImportForm model={model} />
      ) : (
        <>
          {!model.hideHeader ? <Header model={model} /> : null}
          {error ? (
            <div style={{ textAlign: 'center', color: 'red' }}>
              {error.message}
            </div>
          ) : (
            <>
              <Rubberband height={SCALE_BAR_HEIGHT} model={model}>
                <ScaleBar model={model} height={SCALE_BAR_HEIGHT} />
              </Rubberband>
              {!tracks.length ? (
                <Container className={classes.noTracksMessage}>
                  <Typography>
                    No tracks active, click the "select tracks" button to choose
                    some.
                  </Typography>
                </Container>
              ) : (
                tracks.map(track => (
                  <TrackContainer key={track.id} model={model} track={track} />
                ))
              )}
            </>
          )}
        </>
      )}
    </div>
  )
})

export default LinearGenomeView
