import Typography from '@material-ui/core/Typography'
import { observer } from 'mobx-react'
import React from 'react'
import { makeStyles } from '@material-ui/core'
import Link from '@material-ui/core/Link'

const useStyles = makeStyles(theme => ({
  root: {
    margin: theme.spacing(2),
  },
  subtitle: {
    margin: theme.spacing(),
  },
}))

function About() {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <Typography variant="h4" align="center" color="primary">
        JBrowse 2
      </Typography>
      <Typography variant="h6" align="center" className={classes.subtitle}>
        JBrowse 2.0.0-alpha.2
      </Typography>
      <Typography align="center" variant="body2">
        JBrowse is a{' '}
        <Link href="http://gmod.org/" target="_blank" rel="noopener noreferrer">
          GMOD
        </Link>{' '}
        project
      </Typography>
      <br />
      <Typography align="center">
        © 2007-2017 The Evolutionary Software Foundation
      </Typography>
      <br />
      <Typography align="center">
        JBrowse is funded by the{' '}
        <Link
          href="https://genome.gov/"
          target="_blank"
          rel="noopener noreferrer"
        >
          NHGRI
        </Link>
      </Typography>
    </div>
  )
}

export default observer(About)
