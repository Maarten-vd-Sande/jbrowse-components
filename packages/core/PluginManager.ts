import {
  isModelType,
  isType,
  types,
  IAnyType,
  IAnyModelType,
} from 'mobx-state-tree'

// Pluggable elements
import PluggableElementBase from './pluggableElementTypes/PluggableElementBase'
import RendererType from './pluggableElementTypes/renderers/RendererType'
import AdapterType from './pluggableElementTypes/AdapterType'
import TrackType from './pluggableElementTypes/TrackType'
import DisplayType from './pluggableElementTypes/DisplayType'
import ViewType from './pluggableElementTypes/ViewType'
import WidgetType from './pluggableElementTypes/WidgetType'
import ConnectionType from './pluggableElementTypes/ConnectionType'
import RpcMethodType from './pluggableElementTypes/RpcMethodType'
import InternetAccountType from './pluggableElementTypes/InternetAccountType'
import TextSearchAdapterType from './pluggableElementTypes/TextSearchAdapterType'
import AddTrackWorkflowType from './pluggableElementTypes/AddTrackWorkflowType'

import {
  ConfigurationSchema,
  isBareConfigurationSchemaType,
} from './configuration'

import Plugin from './Plugin'
import ReExports from './ReExports'

import {
  PluggableElementType,
  PluggableElementMember,
} from './pluggableElementTypes'
import { AbstractRootModel } from './util'
import CorePlugin from './CorePlugin'
import createJexlInstance from './util/jexl'
import { PluginDefinition } from './PluginLoader'

/** little helper class that keeps groups of callbacks that are
then run in a specified order by group */
class PhasedScheduler<PhaseName extends string> {
  phaseCallbacks = new Map<PhaseName, Function[]>()

  phaseOrder: PhaseName[] = []

  constructor(...phaseOrder: PhaseName[]) {
    this.phaseOrder = phaseOrder
  }

  add(phase: PhaseName, callback: Function) {
    if (!this.phaseOrder.includes(phase)) {
      throw new Error(`unknown phase ${phase}`)
    }
    let phaseCallbacks = this.phaseCallbacks.get(phase)
    if (!phaseCallbacks) {
      phaseCallbacks = []
      this.phaseCallbacks.set(phase, phaseCallbacks)
    }
    phaseCallbacks.push(callback)
  }

  run() {
    this.phaseOrder.forEach(phaseName => {
      this.phaseCallbacks.get(phaseName)?.forEach(callback => callback())
    })
  }
}

type PluggableElementTypeGroup =
  | 'renderer'
  | 'adapter'
  | 'display'
  | 'track'
  | 'connection'
  | 'view'
  | 'widget'
  | 'rpc method'
  | 'internet account'
  | 'text search adapter'
  | 'add track workflow'

/** internal class that holds the info for a certain element type */
class TypeRecord<ElementClass extends PluggableElementBase> {
  registeredTypes: { [name: string]: ElementClass } = {}

  constructor(
    public typeName: string,
    public baseClass: // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | { new (...args: any[]): ElementClass }
      // covers abstract class case
      | (Function & {
          prototype: ElementClass
        }),
  ) {}

  add(name: string, t: ElementClass) {
    this.registeredTypes[name] = t
  }

  has(name: string) {
    return name in this.registeredTypes
  }

  get(name: string) {
    if (!this.has(name)) {
      throw new Error(
        `${this.typeName} '${name}' not found, perhaps its plugin is not loaded or its plugin has not added it.`,
      )
    }
    return this.registeredTypes[name]
  }

  all() {
    return Object.values(this.registeredTypes)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any) => any

/**
 * free-form string-to-unknown mapping of metadata related to the instance
 * of this plugin. `isCore` is typically set to `Boolean(true)` if the plugin was
 * loaded as part of the "core" set of plugins for this application.
 * Can also use this metadata to stash other things about why the plugin is
 * loaded, such as where it came from, what plugin depends on it, etc.
 */
export type PluginMetadata = Record<string, unknown>

export interface PluginLoadRecord {
  metadata?: PluginMetadata
  plugin: Plugin
}
export interface RuntimePluginLoadRecord extends PluginLoadRecord {
  definition: PluginDefinition
}

export default class PluginManager {
  plugins: Plugin[] = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jexl: any = createJexlInstance()

  pluginMetadata: Record<string, PluginMetadata> = {}

  runtimePluginDefinitions: PluginDefinition[] = []

  elementCreationSchedule = new PhasedScheduler<PluggableElementTypeGroup>(
    'renderer',
    'adapter',
    'text search adapter',
    'display',
    'track',
    'connection',
    'view',
    'widget',
    'rpc method',
    'internet account',
    'add track workflow',
  ) as PhasedScheduler<PluggableElementTypeGroup> | undefined

  rendererTypes = new TypeRecord('RendererType', RendererType)

  adapterTypes = new TypeRecord('AdapterType', AdapterType)

  textSearchAdapterTypes = new TypeRecord(
    'TextSearchAdapterType',
    TextSearchAdapterType,
  )

  trackTypes = new TypeRecord('TrackType', TrackType)

  displayTypes = new TypeRecord('DisplayType', DisplayType)

  connectionTypes = new TypeRecord('ConnectionType', ConnectionType)

  viewTypes = new TypeRecord('ViewType', ViewType)

  widgetTypes = new TypeRecord('WidgetType', WidgetType)

  rpcMethods = new TypeRecord('RpcMethodType', RpcMethodType)

  addTrackWidgets = new TypeRecord('AddTrackWorkflow', AddTrackWorkflowType)

  internetAccountTypes = new TypeRecord(
    'InternetAccountType',
    InternetAccountType,
  )

  configured = false

  rootModel?: AbstractRootModel

  extensionPoints: Map<string, Function[]> = new Map()

  constructor(initialPlugins: (Plugin | PluginLoadRecord)[] = []) {
    // add the core plugin
    this.addPlugin({ plugin: new CorePlugin(), metadata: { isCore: true } })

    // add all the initial plugins
    initialPlugins.forEach(plugin => {
      this.addPlugin(plugin)
    })
  }

  pluginConfigurationSchemas() {
    const configurationSchemas: { [key: string]: unknown } = {}
    this.plugins.forEach(plugin => {
      if (plugin.configurationSchema) {
        configurationSchemas[plugin.name] = plugin.configurationSchema
      }
    })
    return configurationSchemas
  }

  addPlugin(load: Plugin | PluginLoadRecord | RuntimePluginLoadRecord) {
    if (this.configured) {
      throw new Error('JBrowse already configured, cannot add plugins')
    }
    const [plugin, metadata = {}] =
      load instanceof Plugin ? [load, {}] : [load.plugin, load.metadata]

    if (this.plugins.includes(plugin)) {
      throw new Error('plugin already installed')
    }

    this.pluginMetadata[plugin.name] = metadata
    if ('definition' in load) {
      this.runtimePluginDefinitions.push(load.definition)
    }
    plugin.install(this)
    this.plugins.push(plugin)
    return this
  }

  getPlugin(name: string) {
    return this.plugins.find(p => p.name === name)
  }

  hasPlugin(name: string) {
    return this.getPlugin(name) !== undefined
  }

  createPluggableElements() {
    // run the creation callbacks for each element type in order.
    // see elementCreationSchedule above for the creation order
    if (this.elementCreationSchedule) {
      this.elementCreationSchedule.run()
      delete this.elementCreationSchedule
    }
    return this
  }

  setRootModel(rootModel: AbstractRootModel) {
    this.rootModel = rootModel
  }

  configure() {
    if (this.configured) {
      throw new Error('already configured')
    }

    this.plugins.forEach(plugin => plugin.configure(this))

    this.configured = true

    // console.log(JSON.stringify(getSnapshot(model)))

    return this
  }

  getElementTypeRecord(
    groupName: PluggableElementTypeGroup,
  ): TypeRecord<PluggableElementBase> {
    switch (groupName) {
      case 'adapter':
        return this.adapterTypes
      case 'text search adapter':
        return this.textSearchAdapterTypes
      case 'connection':
        return this.connectionTypes
      case 'widget':
        return this.widgetTypes
      case 'renderer':
        return this.rendererTypes
      case 'display':
        return this.displayTypes
      case 'track':
        return this.trackTypes
      case 'view':
        return this.viewTypes
      case 'rpc method':
        return this.rpcMethods
      case 'internet account':
        return this.internetAccountTypes
      case 'add track workflow':
        return this.addTrackWidgets
      default:
        throw new Error(`invalid element type '${groupName}'`)
    }
  }

  addElementType(
    groupName: PluggableElementTypeGroup,
    creationCallback: (pluginManager: PluginManager) => PluggableElementType,
  ) {
    if (typeof creationCallback !== 'function') {
      throw new Error(
        'must provide a callback function that returns the new type object',
      )
    }
    const typeRecord = this.getElementTypeRecord(groupName)

    this.elementCreationSchedule?.add(groupName, () => {
      const newElement = creationCallback(this)
      if (!newElement.name) {
        throw new Error(`cannot add a ${groupName} with no name`)
      }

      if (typeRecord.has(newElement.name)) {
        throw new Error(
          `${groupName} ${newElement.name} already registered, cannot register it again`,
        )
      }

      typeRecord.add(
        newElement.name,
        this.evaluateExtensionPoint(
          'Core-extendPluggableElement',
          newElement,
        ) as PluggableElementType,
      )
    })

    return this
  }

  getElementType(groupName: PluggableElementTypeGroup, typeName: string) {
    return this.getElementTypeRecord(groupName).get(typeName)
  }

  getElementTypesInGroup(groupName: PluggableElementTypeGroup) {
    return this.getElementTypeRecord(groupName).all()
  }

  /** get a MST type for the union of all specified pluggable MST types */
  pluggableMstType(
    groupName: PluggableElementTypeGroup,
    fieldName: PluggableElementMember,
    fallback: IAnyType = types.maybe(types.null),
  ) {
    const pluggableTypes = this.getElementTypeRecord(groupName)
      .all()
      // @ts-ignore
      .map(t => t[fieldName])
      .filter(t => isType(t) && isModelType(t)) as IAnyType[]

    // try to smooth over the case when no types are registered, mostly
    // encountered in tests
    if (pluggableTypes.length === 0) {
      console.warn(
        `No pluggable types found matching ('${groupName}','${fieldName}')`,
      )
      return fallback
    }
    return types.union(...pluggableTypes)
  }

  /** get a MST type for the union of all specified pluggable config schemas */
  pluggableConfigSchemaType(
    typeGroup: PluggableElementTypeGroup,
    fieldName: PluggableElementMember = 'configSchema',
  ) {
    const pluggableTypes = this.getElementTypeRecord(typeGroup)
      .all()
      // @ts-ignore
      .map(t => t[fieldName])
      .filter(t => isBareConfigurationSchemaType(t)) as IAnyType[]

    if (pluggableTypes.length === 0) {
      pluggableTypes.push(ConfigurationSchema('Null', {}))
    }
    return types.union(...pluggableTypes) as IAnyModelType
  }

  jbrequireCache = new Map()

  lib = ReExports

  load = <FTYPE extends AnyFunction>(lib: FTYPE): ReturnType<FTYPE> => {
    if (!this.jbrequireCache.has(lib)) {
      this.jbrequireCache.set(lib, lib(this))
    }
    return this.jbrequireCache.get(lib)
  }

  /**
   * Get the re-exported version of the given package name.
   * Throws an error if the package is not re-exported by the plugin manager.
   *
   * @returns the library's default export
   */
  jbrequire = (
    lib: keyof typeof ReExports | AnyFunction | { default: AnyFunction },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any => {
    if (typeof lib === 'string') {
      const pack = this.lib[lib]
      if (!pack) {
        throw new TypeError(
          `No jbrequire re-export defined for package '${lib}'. If this package must be shared between plugins, add it to ReExports.js. If it does not need to be shared, just import it normally.`,
        )
      }
      return pack
    }

    if (typeof lib === 'function') {
      return this.load(lib)
    }

    if (lib.default) {
      return this.jbrequire(lib.default)
    }

    throw new TypeError(
      'lib passed to jbrequire must be either a string or a function',
    )
  }

  getRendererType(typeName: string): RendererType {
    return this.rendererTypes.get(typeName)
  }

  getRendererTypes(): RendererType[] {
    return this.rendererTypes.all()
  }

  getAdapterType(typeName: string): AdapterType {
    return this.adapterTypes.get(typeName)
  }

  getTextSearchAdapterType(typeName: string): TextSearchAdapterType {
    return this.textSearchAdapterTypes.get(typeName)
  }

  getTrackType(typeName: string): TrackType {
    return this.trackTypes.get(typeName)
  }

  getDisplayType(typeName: string): DisplayType {
    return this.displayTypes.get(typeName)
  }

  getViewType(typeName: string): ViewType {
    return this.viewTypes.get(typeName)
  }

  getAddTrackWorkflow(typeName: string): AddTrackWorkflowType {
    return this.addTrackWidgets.get(typeName)
  }

  getWidgetType(typeName: string): WidgetType {
    return this.widgetTypes.get(typeName)
  }

  getConnectionType(typeName: string): ConnectionType {
    return this.connectionTypes.get(typeName)
  }

  getRpcMethodType(methodName: string): RpcMethodType {
    return this.rpcMethods.get(methodName)
  }

  getInternetAccountType(name: string): InternetAccountType {
    return this.internetAccountTypes.get(name)
  }

  addRendererType(cb: (pm: PluginManager) => RendererType) {
    return this.addElementType('renderer', cb)
  }

  addAdapterType(cb: (pm: PluginManager) => AdapterType) {
    return this.addElementType('adapter', cb)
  }

  addTextSearchAdapterType(cb: (pm: PluginManager) => TextSearchAdapterType) {
    return this.addElementType('text search adapter', cb)
  }

  addTrackType(cb: (pm: PluginManager) => TrackType) {
    // Goes through the already-created displays and registers the ones that
    // specify this track type
    const callback = () => {
      const track = cb(this)
      const displays = this.getElementTypesInGroup('display') as DisplayType[]
      displays.forEach(display => {
        // track may have already added the displayType in its cb
        if (
          display.trackType === track.name &&
          !track.displayTypes.includes(display)
        ) {
          track.addDisplayType(display)
        }
      })
      return track
    }
    return this.addElementType('track', callback)
  }

  addDisplayType(cb: (pluginManager: PluginManager) => DisplayType) {
    return this.addElementType('display', cb)
  }

  addViewType(cb: (pluginManager: PluginManager) => ViewType) {
    const callback = () => {
      const newView = cb(this)
      const displays = this.getElementTypesInGroup('display') as DisplayType[]
      displays.forEach(display => {
        // view may have already added the displayType in its callback
        // see ViewType for description of extendedName
        if (
          (display.viewType === newView.name ||
            display.viewType === newView.extendedName) &&
          !newView.displayTypes.includes(display)
        ) {
          newView.addDisplayType(display)
        }
      })
      return newView
    }
    return this.addElementType('view', callback)
  }

  addWidgetType(cb: (pm: PluginManager) => WidgetType) {
    return this.addElementType('widget', cb)
  }

  addConnectionType(cb: (pm: PluginManager) => ConnectionType) {
    return this.addElementType('connection', cb)
  }

  addRpcMethod(cb: (pm: PluginManager) => RpcMethodType) {
    return this.addElementType('rpc method', cb)
  }

  addInternetAccountType(cb: (pm: PluginManager) => InternetAccountType) {
    return this.addElementType('internet account', cb)
  }

  addAddTrackWorkflowType(cb: (pm: PluginManager) => AddTrackWorkflowType) {
    return this.addElementType('add track workflow', cb)
  }

  addToExtensionPoint<T>(
    extensionPointName: string,
    callback: (extendee: T) => T,
  ) {
    let callbacks = this.extensionPoints.get(extensionPointName)
    if (!callbacks) {
      callbacks = []
      this.extensionPoints.set(extensionPointName, callbacks)
    }
    callbacks.push(callback)
  }

  evaluateExtensionPoint(extensionPointName: string, extendee: unknown) {
    const callbacks = this.extensionPoints.get(extensionPointName)
    let accumulator = extendee
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          accumulator = callback(accumulator)
        } catch (error) {
          console.error(error)
        }
      }
    }
    return accumulator
  }

  async evaluateAsyncExtensionPoint(
    extensionPointName: string,
    extendee: unknown,
  ) {
    const callbacks = this.extensionPoints.get(extensionPointName)
    let accumulator = extendee
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          accumulator = await callback(accumulator)
        } catch (error) {
          console.error(error)
        }
      }
    }
    return accumulator
  }
}
