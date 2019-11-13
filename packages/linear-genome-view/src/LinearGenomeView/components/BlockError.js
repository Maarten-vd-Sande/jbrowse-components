import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import Icon from '@material-ui/core/Icon'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'

const useStyles = makeStyles({
  blockError: {
    width: '30em',
    whiteSpace: 'normal',
  },
})

function BlockError({ error, reload }) {
  const classes = useStyles()
  return (
    <div className={classes.blockError}>
      {reload ? (
        <Button
          onClick={reload}
          // variant="outlined"
          size="small"
          startIcon={<Icon color="secondary">refresh</Icon>}
        >
          Reload
        </Button>
      ) : null}
      <Typography color="error" variant="body2">
        {error.message}
      </Typography>
    </div>
  )
}
BlockError.propTypes = {
  error: MobxPropTypes.objectOrObservableObject.isRequired,
  reload: PropTypes.func,
}
BlockError.defaultProps = {
  reload: undefined,
}

export default observer(BlockError)
