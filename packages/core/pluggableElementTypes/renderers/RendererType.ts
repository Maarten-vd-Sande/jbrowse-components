import React from 'react'
import { getDefaultValue } from '../../util/mst-reflection'
import PluggableElementBase from '../PluggableElementBase'
import { AnyConfigurationSchemaType } from '../../configuration'

export default class RendererType extends PluggableElementBase {
  ReactComponent: React.ComponentType

  configSchema: AnyConfigurationSchemaType

  constructor(stuff: {
    name: string
    ReactComponent: React.ComponentType
    configSchema: AnyConfigurationSchemaType
  }) {
    super(stuff)
    this.ReactComponent = stuff.ReactComponent
    this.configSchema = stuff.configSchema

    if (!this.ReactComponent) {
      throw new Error(`no ReactComponent defined for renderer ${this.name}`)
    }
    if (!getDefaultValue(this.configSchema).type) {
      throw new Error(
        `${this.name} config schema ${this.configSchema.name} is not explicitlyTyped`,
      )
    }
  }

  render(props: Record<string, any>) {
    return { element: React.createElement(this.ReactComponent, props, null) }
  }

  /**
   * frees resources associated with the given range, session, etc.
   * optionally returns the number of data items deleted
   */
  freeResources(/* specification */) {}
}
