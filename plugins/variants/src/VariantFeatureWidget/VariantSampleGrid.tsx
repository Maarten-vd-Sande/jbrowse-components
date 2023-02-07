import React, { useState } from 'react'

import {
  FormControlLabel,
  Checkbox,
  TextField,
  Typography,
} from '@mui/material'

import { DataGrid } from '@mui/x-data-grid'
import { BaseCard } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { measureGridWidth, SimpleFeatureSerialized } from '@jbrowse/core/util'
import ResizeBar, { useResizeBar } from '@jbrowse/core/ui/ResizeBar'

interface Entry {
  sample: string
  id: string
  [key: string]: string
}

type InfoFields = Record<string, unknown>
type Filters = Record<string, string>

function SampleFilters({
  columns,
  filter,
  setFilter,
}: {
  columns: { field: string }[]
  filter: Filters
  setFilter: (arg: Filters) => void
}) {
  const [showFilters, setShowFilters] = useState(false)
  return (
    <>
      <FormControlLabel
        control={
          <Checkbox
            checked={showFilters}
            onChange={() => setShowFilters(f => !f)}
          />
        }
        label="Show sample filters"
      />
      {showFilters ? (
        <>
          <Typography>
            These filters can use a plain text search or regex style query, e.g.
            in the genotype field, entering 1 will query for all genotypes that
            include the first alternate allele e.g. 0|1 or 1|1, entering
            [1-9]\d* will find any non-zero allele e.g. 0|2 or 2/33
          </Typography>
          {columns.map(({ field }) => (
            <TextField
              key={`filter-${field}`}
              placeholder={`Filter ${field}`}
              value={filter[field] || ''}
              onChange={event =>
                setFilter({ ...filter, [field]: event.target.value })
              }
            />
          ))}
        </>
      ) : null}
    </>
  )
}

export default function VariantSamples(props: {
  feature: SimpleFeatureSerialized
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  descriptions: any
}) {
  const { feature, descriptions = {} } = props
  const { ref, scrollLeft } = useResizeBar()
  const [filter, setFilter] = useState<Filters>({})
  const samples = (feature.samples || {}) as Record<string, InfoFields>
  const preFilteredRows = Object.entries(samples)

  let error
  let rows = [] as Entry[]
  const filters = Object.keys(filter)

  // catch some error thrown from regex
  // note: maps all values into a string, if this is not done rows are not
  // sortable by the data-grid
  try {
    rows = preFilteredRows
      .map(row => {
        return {
          ...Object.fromEntries(
            Object.entries(row[1]).map(e => [e[0], `${e[1]}`]),
          ),
          sample: row[0],
          id: row[0],
        } as Entry
      })
      .filter(row =>
        filters.length
          ? filters.every(key => {
              const val = row[key]
              const currFilter = filter[key]
              return currFilter ? val.match(new RegExp(currFilter, 'i')) : true
            })
          : true,
      )
  } catch (e) {
    error = e
  }

  const keys = ['sample', ...Object.keys(preFilteredRows[0]?.[1] || {})]

  const [widths, setWidths] = useState(
    keys.map(e => measureGridWidth(rows.map(r => r[e]))),
  )
  const columns = keys.map((field, index) => ({
    field,
    description: descriptions.FORMAT?.[field]?.Description,
    width: widths[index],
  }))

  // disableSelectionOnClick helps avoid
  // https://github.com/mui-org/material-ui-x/issues/1197
  return !preFilteredRows.length ? null : (
    <BaseCard {...props} title="Samples">
      {error ? <Typography color="error">{`${error}`}</Typography> : null}
      <SampleFilters setFilter={setFilter} columns={columns} filter={filter} />
      <div ref={ref}>
        <ResizeBar
          widths={widths}
          setWidths={setWidths}
          scrollLeft={scrollLeft}
        />
        <div ref={ref} style={{ height: 600, width: '100%', overflow: 'auto' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            disableSelectionOnClick
            rowHeight={25}
            headerHeight={35}
            disableColumnMenu
          />
        </div>
      </div>
    </BaseCard>
  )
}
