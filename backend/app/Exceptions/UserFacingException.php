<?php

namespace App\Exceptions;

/**
 * An error whose message was written for the person using the app
 * ("Insufficient stock for ...", "Owner has no email address.").
 *
 * Only these messages are shown to clients. Any other exception may carry
 * SQL, table names or file paths, so callers log it and answer with a
 * generic message instead. Rendered as 422 by bootstrap/app.php.
 */
class UserFacingException extends \RuntimeException {}
