import { fireEvent, within } from '@testing-library/react'

// locals
import {
  setup,
  expectCanvasMatch,
  doBeforeEach,
  createView,
  pc,
  hts,
} from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }

test('opens the track menu and enables soft clipping', async () => {
  console.error = jest.fn()
  const { view, findByTestId, findByText } = createView()
  await findByText('Help')
  view.setNewView(0.02, 142956)

  // load track
  fireEvent.click(
    await findByTestId(hts('volvox-long-reads-sv-bam'), {}, delay),
  )
  await findByTestId(
    'display-volvox-long-reads-sv-bam-LinearAlignmentsDisplay',
    {},
    delay,
  )
  expect(view.tracks[0]).toBeTruthy()

  // opens the track menu
  fireEvent.click(await findByTestId('track_menu_icon'))
  fireEvent.click(await findByText('Show soft clipping'))

  // wait for block to rerender
  const { findByTestId: f0 } = within(await findByTestId('Blockset-pileup'))

  expectCanvasMatch(
    await f0(pc('softclipped_{volvox}ctgA:2849..2864-0'), {}, delay),
  )
}, 30000)

test('selects a sort, sort by strand', async () => {
  console.error = jest.fn()
  const { view, findByTestId, findByText, findAllByTestId } = createView()
  await findByText('Help')
  view.setNewView(0.02, 2086500)

  // load track
  fireEvent.click(await findByTestId(hts('volvox-long-reads-cram'), {}, delay))
  await findByTestId(
    'display-volvox-long-reads-cram-LinearAlignmentsDisplay',
    {},
    delay,
  )
  expect(view.tracks[0]).toBeTruthy()

  fireEvent.click(await findByTestId('track_menu_icon'))
  fireEvent.click(await findByText('Sort by'))
  fireEvent.click(await findByText('Read strand'))

  // wait for pileup track to render with sort
  await findAllByTestId('pileup-Read strand', {}, delay)
  const { findByTestId: find1 } = within(await findByTestId('Blockset-pileup'))
  expectCanvasMatch(await find1(pc('{volvox}ctgA:41729..41744-0'), {}, delay))
}, 35000)

test('color by strand', async () => {
  console.error = jest.fn()
  const { view, findByTestId, findByText, findAllByTestId } = createView()
  await findByText('Help')
  view.setNewView(0.02, 2086500)

  // load track
  fireEvent.click(await findByTestId(hts('volvox-long-reads-cram'), {}, delay))
  await findByTestId(
    'display-volvox-long-reads-cram-LinearAlignmentsDisplay',
    {},
    delay,
  )

  fireEvent.click(await findByTestId('track_menu_icon'))
  fireEvent.click(await findByText('Color scheme'))
  fireEvent.click(await findByText('Strand'))

  // wait for pileup track to render with color
  await findAllByTestId('pileup-strand', {}, delay)
  const { findByTestId: find1 } = within(await findByTestId('Blockset-pileup'))
  expectCanvasMatch(await find1(pc('{volvox}ctgA:41729..41744-0'), {}, delay))
}, 30000)

test('color by tag', async () => {
  console.error = jest.fn()
  const { view, findByTestId, findByText, findAllByTestId } = createView()
  await findByText('Help')
  view.setNewView(0.465, 85055)

  // load track
  fireEvent.click(await findByTestId(hts('volvox_cram'), {}, delay))
  await findByTestId('display-volvox_cram-LinearAlignmentsDisplay', {}, delay)
  expect(view.tracks[0]).toBeTruthy()

  // colors by HP tag
  fireEvent.click(await findByTestId('track_menu_icon'))
  fireEvent.click(await findByText('Color scheme'))
  fireEvent.click(await findByText('Color by tag...'))
  fireEvent.change(await findByTestId('color-tag-name-input'), {
    target: { value: 'HP' },
  })
  fireEvent.click(await findByText('Submit'))
  // wait for pileup track to render with color
  await findAllByTestId('pileup-tagHP', {}, delay)
  const { findByTestId: find1 } = within(await findByTestId('Blockset-pileup'))
  expectCanvasMatch(await find1(pc('{volvox}ctgA:39805..40176-0'), {}, delay))
}, 30000)
