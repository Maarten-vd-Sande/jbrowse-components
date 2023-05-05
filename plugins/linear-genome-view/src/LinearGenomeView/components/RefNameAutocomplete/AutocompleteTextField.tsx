import React from 'react'
import {
  AutocompleteRenderInputParams,
  TextField,
  TextFieldProps as TFP,
} from '@mui/material'

// locals
import EndAdornment from './EndAdornment'

export default function AutocompleteTextField({
  TextFieldProps,
  inputBoxVal,
  params,
  showHelp,
  setInputValue,
  setCurrentSearch,
}: {
  TextFieldProps: TFP
  inputBoxVal: string
  showHelp?: boolean
  params: AutocompleteRenderInputParams
  setInputValue: (arg: string) => void
  setCurrentSearch: (arg: string) => void
}) {
  const { helperText, InputProps = {} } = TextFieldProps
  return (
    <TextField
      onBlur={() =>
        // this is used to restore a refName or the non-user-typed input
        // to the box on blurring
        setInputValue(inputBoxVal)
      }
      {...params}
      {...TextFieldProps}
      size="small"
      helperText={helperText}
      InputProps={{
        ...params.InputProps,
        ...InputProps,

        endAdornment: (
          <EndAdornment
            showHelp={showHelp}
            endAdornment={params.InputProps.endAdornment}
          />
        ),
      }}
      placeholder="Search for location"
      onChange={e => setCurrentSearch(e.target.value)}
    />
  )
}
