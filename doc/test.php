PHP File!
<pre>
<?
print "<table>";
foreach ($_REQUEST as $key => $value) {
  print "<tr><th>$key<td>$value";
 }
print "</table>";
?>
</pre>