describe('Messaging flow', () => {
  const base = 'http://localhost:5173'

  before(() => {
    // Set an auth token in localStorage to simulate a logged-in user.
    // In a real CI run you may want to call the backend login endpoint.
    cy.visit(base)
    cy.window().then((win) => {
      win.localStorage.setItem('auth_token', 'test-token-for-e2e')
      // Also set a user role and station if app uses them
      win.localStorage.setItem('user_role', 'RECEPTION_OFFICER')
    })
  })

  it('compose -> send -> recipient reads message (attachments)', () => {
    // Open compose
    cy.visit(`${base}/messaging/compose`)

    // Add a recipient by typing part of address (client fetches mailboxes)
    cy.get('input[placeholder="Type mailbox address to search..."]').type('reception')
    cy.wait(300)
    cy.get('ul').contains('@').click()

    cy.get('input[placeholder="Subject"]').type('E2E Attachment Test')
    cy.get('textarea').type('Please find attached')

    // Attach a small file
    const fileName = 'hello.txt'
    cy.fixture(fileName).then(fileContent => {
      cy.get('input[type=file]').attachFile({ fileContent, fileName, mimeType: 'text/plain' })
    })

    // Submit form
    cy.get('button').contains('Send').click()

    // After send, should navigate to thread view
    cy.url().should('include', '/messaging/threads/')

    // Thread should show message and attachment link
    cy.contains('Please find attached')
    cy.get('a').contains('hello.txt')
  })
})
