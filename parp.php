<?
/*
Copyright (c) 2009, Eric Fredricksen <e@fredricksen.net>

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/

// Command-line use of PHP files as if from a webserver.
//
// Usage: php parp.php file.php arg1=value1 arg2=value2...
//   Simulates HTTP request for /file.php?arg1=value1&arg2=value2...
// Opts:
//   -r  Subsequent key=value pairs are stored in $_REQUEST (default)
//   -s  Subsequent key=value pairs are stored in $_SERVER
//   -S  Subsequent key=value pairs are stored in $_SESSION
//   --dir=DIR  Change directory to specified document root DIR  


//fputs(STDERR, var_export($argv, TRUE));

session_start();

$_SESSION['nickname'] = 'Nicholas'; // TODO:
$_SESSION['player'] = 1;            // TEMPORARY

$target =& $_REQUEST;

for ($i = 2; $i < count($argv); ++$i) {
  if ($argv[$i] == "-s") {
    $target =& $_SERVER;
  } else if ($argv[$i] == "-r") {
    $target =& $_REQUEST;
  } else if ($argv[$i] == "-S") {
    $target =& $_SESSION;
  } else {
    $v = explode("=", $argv[$i]);
    if ($v[0] == "--dir")
      chdir($v[1]);
    else
      $target[urldecode($v[0])] = urldecode($v[1]);
  }
}

//ob_start();
$included = @include($argv[1]);
//$output = ob_get_contents();
//ob_end_clean();

//print $ouput;

if (!$included) {
  print "404: No sign of it";
}

//fputs(STDERR, $output);

?>