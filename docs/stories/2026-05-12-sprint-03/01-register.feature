Feature: Register a new account with username and password
  As a new visitor to Tris
  I want to create an account with a username and password
  So that my identity is uniquely tied to my matches and leaderboard entries

  Background:
    Given the Tris registration page is displayed
    And no user is currently logged in

  Scenario: Successful registration with valid credentials
    When the visitor enters "alice" as the username
    And the visitor enters "S3cure!" as the password
    And the visitor submits the registration form
    Then the page shows a confirmation that the account was created
    And the visitor is redirected to the login page

  Scenario: Registration rejected when username is already taken
    Given an account with the username "alice" already exists
    When a new visitor enters "alice" as the username
    And the visitor enters any valid password
    And the visitor submits the registration form
    Then an error reads "Username already taken"
    And the visitor remains on the registration page

  Scenario: Registration rejected when username is blank
    When the visitor submits the form with an empty username field
    Then an error reads "Username is required"
    And no account is created

  Scenario: Registration rejected when password is too short
    When the visitor enters "alice" as the username
    And the visitor enters a password shorter than 8 characters
    And the visitor submits the registration form
    Then an error reads "Password must be at least 8 characters"
    And no account is created

  Scenario: Registration rejected when username contains invalid characters
    When the visitor enters "ali ce!" as the username
    And the visitor submits the form
    Then an error reads "Username may only contain letters, digits, and underscores"
    And no account is created

  Scenario: Username is case-insensitively unique
    Given an account with the username "Alice" already exists
    When a new visitor enters "alice" as the username
    And submits a valid registration form
    Then an error reads "Username already taken"

```
## Acceptance criteria
- AC-1: A registration form with a username field and a password field is reachable from the start screen.
- AC-2: On successful submission, the system creates the account and redirects the visitor to the login page.
- AC-3: Duplicate usernames (case-insensitive) are rejected with the message "Username already taken".
- AC-4: Blank username is rejected with "Username is required".
- AC-5: Password shorter than 8 characters is rejected with "Password must be at least 8 characters".
- AC-6: Usernames containing characters other than letters, digits, and underscores are rejected with the appropriate error message.
- AC-7: Passwords are never displayed in plain text on the page.
- AC-8: All sprint-01 and sprint-02 verify.sh scenarios continue to pass.

## NFR
- latency: Form submission feedback (success or error) must appear within 2 seconds on a local-network connection.
- throughput: unknown — needs sales-feedback.
- error budget: Zero unhandled exceptions on the registration path; validation errors must be user-visible, not silent.

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
