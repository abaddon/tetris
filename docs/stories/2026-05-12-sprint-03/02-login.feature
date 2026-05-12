Feature: Login with an existing account
  As a registered Tris player
  I want to log in with my username and password
  So that my session is authenticated and my match history is associated with my identity

  Background:
    Given an account with username "alice" and a known password exists
    And the Tris login page is displayed

  Scenario: Successful login with correct credentials
    When the user enters "alice" as the username
    And the user enters the correct password
    And the user submits the login form
    Then the page shows the Tris lobby
    And the header or nav area displays "alice" as the logged-in player

  Scenario: Login rejected with wrong password
    When the user enters "alice" as the username
    And the user enters an incorrect password
    And the user submits the login form
    Then an error reads "Invalid username or password"
    And the user remains on the login page

  Scenario: Login rejected with non-existent username
    When the user enters "ghost" as the username
    And the user enters any password
    And the user submits the login form
    Then an error reads "Invalid username or password"
    And no information leaks about whether the username exists

  Scenario: Login form rejects blank username
    When the user submits the login form with an empty username field
    Then an error reads "Username is required"
    And no authentication attempt is made

  Scenario: Session persists across a page reload
    Given the user "alice" has just logged in successfully
    When the user reloads the page
    Then the lobby is still shown
    And the header still displays "alice" as the logged-in player

  Scenario: User can log out and is returned to the login page
    Given "alice" is logged in and on the lobby page
    When the user triggers the "Log out" action
    Then the login page is displayed
    And the header no longer shows a logged-in username
    And a subsequent reload still shows the login page

```
## Acceptance criteria
- AC-1: A login form with username and password fields is the default view for unauthenticated visitors.
- AC-2: Correct credentials grant access to the lobby; the logged-in username is visible in the UI.
- AC-3: Wrong credentials produce "Invalid username or password" without distinguishing which field was wrong.
- AC-4: A blank username field is caught client-side before any authentication attempt.
- AC-5: The session survives a page reload (the user does not have to log in again after refreshing).
- AC-6: A "Log out" control is available in the authenticated view; using it destroys the session and returns to the login page.
- AC-7: All sprint-01 and sprint-02 verify.sh scenarios continue to pass.

## NFR
- latency: Login response (success or error) must appear within 2 seconds on a local-network connection.
- throughput: unknown — needs sales-feedback.
- error budget: Zero unhandled exceptions on the login/logout path.

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
