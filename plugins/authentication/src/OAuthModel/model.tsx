import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { isElectron } from '@jbrowse/core/util'
import sha256 from 'crypto-js/sha256'
import Base64 from 'crypto-js/enc-base64'
import { Instance, types } from 'mobx-state-tree'

// locals
import { OAuthInternetAccountConfigModel } from './configSchema'

interface OAuthData {
  client_id: string
  redirect_uri: string
  response_type: 'token' | 'code'
  scope?: string
  code_challenge?: string
  code_challenge_method?: string
  token_access_type?: string
}

function fixup(buf: string) {
  return buf.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function getGlobalObject(): Window {
  // Based on window-or-global
  // https://github.com/purposeindustries/window-or-global/blob/322abc71de0010c9e5d9d0729df40959e1ef8775/lib/index.js
  return (
    /* eslint-disable-next-line no-restricted-globals */
    (typeof self === 'object' && self.self === self && self) ||
    (typeof global === 'object' && global.global === global && global) ||
    // @ts-ignore
    this
  )
}

const stateModelFactory = (configSchema: OAuthInternetAccountConfigModel) => {
  return types
    .compose(
      'OAuthInternetAccount',
      InternetAccount,
      types.model('OAuthModel', {
        type: types.literal('OAuthInternetAccount'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => {
      const global = getGlobalObject()
      const array = new Uint8Array(32)
      global.crypto.getRandomValues(array)
      const codeVerifierPKCE = fixup(Buffer.from(array).toString('base64'))
      return { codeVerifierPKCE }
    })
    .views(self => ({
      get authEndpoint(): string {
        return getConf(self, 'authEndpoint')
      },
      get tokenEndpoint(): string {
        return getConf(self, 'tokenEndpoint')
      },
      get needsPKCE(): boolean {
        return getConf(self, 'needsPKCE')
      },
      get clientId(): string {
        return getConf(self, 'clientId')
      },
      get scopes(): string {
        return getConf(self, 'scopes')
      },
      get responseType(): 'token' | 'code' {
        return getConf(self, 'responseType')
      },
      get hasRefreshToken(): boolean {
        return getConf(self, 'hasRefreshToken')
      },
      get refreshTokenKey() {
        return `${self.internetAccountId}-refreshToken`
      },
    }))
    .actions(self => ({
      storeRefreshToken(refreshToken: string) {
        localStorage.setItem(self.refreshTokenKey, refreshToken)
      },
      removeRefreshToken() {
        localStorage.removeItem(self.refreshTokenKey)
      },
      retrieveRefreshToken() {
        return localStorage.getItem(self.refreshTokenKey)
      },
      async exchangeAuthorizationForAccessToken(
        token: string,
        redirectUri: string,
      ): Promise<string> {
        const data = {
          code: token,
          grant_type: 'authorization_code',
          client_id: self.clientId,
          code_verifier: self.codeVerifierPKCE,
          redirect_uri: redirectUri,
        }

        const params = new URLSearchParams(Object.entries(data))

        const response = await fetch(self.tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        })

        if (!response.ok) {
          let errorMessage
          try {
            errorMessage = await response.text()
          } catch (error) {
            errorMessage = ''
          }
          throw new Error(
            `Failed to obtain token from endpoint: ${response.status} (${
              response.statusText
            })${errorMessage ? ` (${errorMessage})` : ''}`,
          )
        }

        const accessToken = await response.json()
        if (accessToken.refresh_token) {
          this.storeRefreshToken(accessToken.refresh_token)
        }
        return accessToken.access_token
      },
      async exchangeRefreshForAccessToken(
        refreshToken: string,
      ): Promise<string> {
        const data = {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: self.clientId,
        }

        const params = new URLSearchParams(Object.entries(data))

        const response = await fetch(self.tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        })

        if (!response.ok) {
          self.removeToken()
          let errorMessage
          try {
            errorMessage = await response.text()
          } catch (error) {
            errorMessage = ''
          }
          throw new Error(
            `Network response failure — ${response.status} (${
              response.statusText
            }) ${errorMessage ? ` (${errorMessage})` : ''}`,
          )
        }

        const accessToken = await response.json()
        return accessToken.access_token
      },
    }))
    .actions(self => {
      let listener: (event: MessageEvent) => void
      return {
        // used to listen to child window for auth code/token
        addMessageChannel(
          resolve: (token: string) => void,
          reject: (error: Error) => void,
        ) {
          listener = event => {
            this.finishOAuthWindow(event, resolve, reject)
          }
          window.addEventListener('message', listener)
        },
        deleteMessageChannel() {
          window.removeEventListener('message', listener)
        },
        async finishOAuthWindow(
          event: MessageEvent,
          resolve: (token: string) => void,
          reject: (error: Error) => void,
        ) {
          if (
            event.data.name !== `JBrowseAuthWindow-${self.internetAccountId}`
          ) {
            return this.deleteMessageChannel()
          }
          const redirectUriWithInfo = event.data.redirectUri
          if (redirectUriWithInfo.includes('access_token')) {
            const fixedQueryString = redirectUriWithInfo.replace('#', '?')
            const queryStringSearch = new URL(fixedQueryString).search
            const urlParams = new URLSearchParams(queryStringSearch)
            const token = urlParams.get('access_token')
            if (!token) {
              return reject(new Error('Error with token endpoint'))
            }
            self.storeToken(token)
            return resolve(token)
          }
          if (redirectUriWithInfo.includes('code')) {
            const redirectUri = new URL(redirectUriWithInfo)
            const queryString = redirectUri.search
            const urlParams = new URLSearchParams(queryString)
            const code = urlParams.get('code')
            if (!code) {
              return reject(new Error('Error with authorization endpoint'))
            }
            try {
              const token = await self.exchangeAuthorizationForAccessToken(
                code,
                redirectUri.origin + redirectUri.pathname,
              )
              self.storeToken(token)
              return resolve(token)
            } catch (error) {
              if (error instanceof Error) {
                return reject(error)
              } else {
                return reject(new Error(String(error)))
              }
            }
          }
          if (redirectUriWithInfo.includes('access_denied')) {
            return reject(new Error('OAuth flow was cancelled'))
          }
          this.deleteMessageChannel()
        },
        // opens external OAuth flow, popup for web and new browser window for desktop
        async useEndpointForAuthorization(
          resolve: (token: string) => void,
          reject: (error: Error) => void,
        ) {
          const redirectUri = isElectron
            ? 'http://localhost/auth'
            : window.location.origin + window.location.pathname
          const data: OAuthData = {
            client_id: self.clientId,
            redirect_uri: redirectUri,
            response_type: self.responseType || 'code',
          }

          if (self.scopes) {
            data.scope = self.scopes
          }

          if (self.needsPKCE) {
            const { codeVerifierPKCE } = self
            const codeChallenge = fixup(
              Base64.stringify(sha256(codeVerifierPKCE)),
            )
            data.code_challenge = codeChallenge
            data.code_challenge_method = 'S256'
          }

          if (self.hasRefreshToken) {
            data.token_access_type = 'offline'
          }

          const params = new URLSearchParams(Object.entries(data))

          const url = new URL(self.authEndpoint)
          url.search = params.toString()

          const eventName = `JBrowseAuthWindow-${self.internetAccountId}`
          if (isElectron) {
            const electron = require('electron')
            const { ipcRenderer } = electron
            const redirectUri = await ipcRenderer.invoke('openAuthWindow', {
              internetAccountId: self.internetAccountId,
              data,
              url: url.toString(),
            })

            const eventFromDesktop = new MessageEvent('message', {
              data: { name: eventName, redirectUri: redirectUri },
            })
            this.finishOAuthWindow(eventFromDesktop, resolve, reject)
          } else {
            const options = `width=500,height=600,left=0,top=0`
            window.open(url, eventName, options)
          }
        },
        async getTokenFromUser(
          resolve: (token: string) => void,
          reject: (error: Error) => void,
        ): Promise<void> {
          const refreshToken =
            self.hasRefreshToken && self.retrieveRefreshToken()
          if (refreshToken) {
            resolve(await self.exchangeRefreshForAccessToken(refreshToken))
          }
          this.addMessageChannel(resolve, reject)
          this.useEndpointForAuthorization(resolve, reject)
        },
      }
    })
}

export default stateModelFactory
export type OAuthStateModel = ReturnType<typeof stateModelFactory>
export type OAuthModel = Instance<OAuthStateModel>
