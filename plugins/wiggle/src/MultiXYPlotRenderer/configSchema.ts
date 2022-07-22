import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'
import ConfigSchema from '../configSchema'

const configSchema = ConfigurationSchema(
  'MultiXYPlotRenderer',
  {
    filled: {
      type: 'boolean',
      defaultValue: true,
    },
    displayCrossHatches: {
      type: 'boolean',
      description: 'choose to draw cross hatches (sideways lines)',
      defaultValue: false,
    },
    summaryScoreMode: {
      type: 'stringEnum',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      defaultValue: 'avg',
    },
    minSize: {
      type: 'number',
      defaultValue: 0,
    },
  },
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)
export default configSchema
