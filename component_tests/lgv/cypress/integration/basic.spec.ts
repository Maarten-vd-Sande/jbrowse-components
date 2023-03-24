describe('JBrowse embedded view', () => {
  it('track loads', () => {
    cy.visit('/')

    // eslint-disable-next-line testing-library/await-async-query,testing-library/prefer-screen-queries
    cy.findByTestId('Blockset-pileup', { timeout: 30000 }).findByTestId(
      'prerendered_canvas_{volvox}ctgA:1..82-0_done',
      { timeout: 30000 },
    )
  })
})
