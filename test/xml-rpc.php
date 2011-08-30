<?

print '<?xml version="1.0" encoding="utf-8"?>';

print '<response sum="';
print intval($_REQUEST['a']) + intval($_REQUEST['b']);
print '"/>';

?>