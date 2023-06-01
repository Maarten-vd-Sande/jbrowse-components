import { flags } from '@oclif/command'
import fs from 'fs'
import path from 'path'
import parseJSON from 'json-parse-better-errors'

// locals
import fetch from '../fetchWithProxy'
import JBrowseCommand from '../base'

interface Connection {
  [key: string]: unknown
}

interface Assembly {
  name: string
  sequence: { [key: string]: unknown }
}

interface Config {
  assemblies?: Assembly[]
  configuration?: {}
  connections?: Connection[]
  defaultSession?: {}
  tracks?: unknown[]
}

export default class AddConnection extends JBrowseCommand {
  // @ts-expect-error
  private target: string

  static description = 'Add a connection to a JBrowse 2 configuration'

  static examples = [
    '$ jbrowse add-connection http://mysite.com/jbrowse/data/ -a hg19',
    '$ jbrowse add-connection http://mysite.com/jbrowse/custom_data_folder/ --type JBrowse1Connection -a hg38',
    '$ jbrowse add-connection http://mysite.com/path/to/hub.txt',
    '$ jbrowse add-connection http://mysite.com/path/to/custom_hub_name.txt --type UCSCTrackHubConnection',
    `$ jbrowse add-connection http://mysite.com/path/to/custom --type custom --config '{"uri":{"url":"https://mysite.com/path/to/custom"}, "locationType": "UriLocation"}' -a hg19`,
    '$ jbrowse add-connection https://mysite.com/path/to/hub.txt --connectionId newId --name newName --target /path/to/jb2/installation/config.json',
  ]

  static args = [
    {
      name: 'connectionUrlOrPath',
      required: true,
      description: `URL of data directory\nFor hub file, usually called hub.txt\nFor JBrowse 1, location of JB1 data directory similar to http://mysite.com/jbrowse/data/ `,
    },
  ]

  static flags = {
    type: flags.string({
      char: 't',
      description:
        'type of connection, ex. JBrowse1Connection, UCSCTrackHubConnection, custom',
    }),
    assemblyNames: flags.string({
      char: 'a',
      description:
        'For UCSC, optional: Comma separated list of assembly name(s) to filter from this connection. For JBrowse: a single assembly name',
    }),
    config: flags.string({
      char: 'c',
      description: `Any extra config settings to add to connection in JSON object format, such as '{"uri":"url":"https://sample.com"}, "locationType": "UriLocation"}'`,
    }),
    connectionId: flags.string({
      description: `Id for the connection that must be unique to JBrowse.  Defaults to 'connectionType-assemblyName-currentTime'`,
    }),
    name: flags.string({
      char: 'n',
      description:
        'Name of the connection. Defaults to connectionId if not provided',
    }),
    target: flags.string({
      description:
        'path to config file in JB2 installation directory to write out to.',
    }),
    out: flags.string({
      description: 'synonym for target',
    }),
    help: flags.help({ char: 'h' }),
    skipCheck: flags.boolean({
      description:
        "Don't check whether or not the data directory URL exists or if you are in a JBrowse directory",
    }),
    overwrite: flags.boolean({
      description: 'Overwrites any existing connections if same connection id',
    }),
    force: flags.boolean({
      char: 'f',
      description: 'Equivalent to `--skipCheck --overwrite`',
    }),
  }

  async run() {
    const { args: runArgs, flags: runFlags } = this.parse(AddConnection)

    const output = runFlags.target || runFlags.out || '.'
    const isDir = fs.lstatSync(output).isDirectory()
    this.target = isDir ? `${output}/config.json` : output

    const { connectionUrlOrPath } = runArgs
    const { assemblyNames, type, name, config, connectionId } = runFlags
    const { skipCheck, force } = runFlags
    const url = await this.resolveURL(
      connectionUrlOrPath,
      !(skipCheck || force),
    )
    const configContents = await this.readJsonFile<Config>(this.target)
    this.debug(`Using config file ${this.target}`)

    if (!configContents.assemblies?.length) {
      this.error(
        'No assemblies found. Please add one before adding connections',
        { exit: 120 },
      )
    }

    const configType = type || this.determineConnectionType(url)
    const id =
      connectionId ||
      [configType, assemblyNames, +Date.now()].filter(f => !!f).join('-')
    const connectionConfig = {
      type: configType,
      name: name || id,
      ...(configType === 'UCSCTrackHubConnection'
        ? {
            hubTxtLocation: {
              uri: url,
              locationType: 'UriLocation',
            },
          }
        : {}),
      ...(configType === 'JBrowse1Connection'
        ? {
            dataDirLocation: {
              uri: url,
              locationType: 'UriLocation',
            },
          }
        : {}),
      connectionId: id,
      assemblyNames:
        assemblyNames || type === 'JBrowse1Connection'
          ? [configContents.assemblies[0]?.name]
          : undefined,
      ...(config ? parseJSON(config) : {}),
    }

    if (!configContents.connections) {
      configContents.connections = []
    }
    const idx = configContents.connections.findIndex(
      c => c.connectionId === connectionId,
    )

    if (idx !== -1) {
      if (runFlags.force || runFlags.overwrite) {
        configContents.connections[idx] = connectionConfig
      } else {
        this.error(
          `Cannot add connection with id ${connectionId}, a connection with that id already exists.\nUse --overwrite if you would like to replace the existing connection`,
          { exit: 150 },
        )
      }
    } else {
      configContents.connections.push(connectionConfig)
    }

    this.debug(`Writing configuration to file ${this.target}`)
    await this.writeJsonFile(this.target, configContents)

    this.log(
      `${idx !== -1 ? 'Overwrote' : 'Added'} connection "${name}" ${
        idx !== -1 ? 'in' : 'to'
      } ${this.target}`,
    )
  }

  async resolveURL(location: string, check = true) {
    let locationUrl: URL | undefined
    try {
      locationUrl = new URL(location)
    } catch (error) {
      this.error('The location provided is not a valid URL', { exit: 160 })
    }
    if (locationUrl) {
      let response
      try {
        if (check) {
          response = await fetch(locationUrl, { method: 'HEAD' })
        }
        if (!response || response.ok) {
          return locationUrl.href
        }
        this.error(`Response returned with code ${response.status}`)
      } catch (error) {
        // ignore
        this.error(`Unable to fetch from URL, ${error}`, { exit: 170 })
      }
    }
    return this.error(`Could not resolve to a URL: "${location}"`, {
      exit: 180,
    })
  }

  determineConnectionType(url: string) {
    if (path.basename(url) === 'hub.txt') {
      return 'UCSCTrackHubConnection'
    }
    if (url.includes('jbrowse/data')) {
      return 'JBrowse1Connection'
    }
    return 'custom'
  }

  isValidJSON(str: string) {
    try {
      JSON.parse(str)
      return true
    } catch (error) {
      return false
    }
  }
}
