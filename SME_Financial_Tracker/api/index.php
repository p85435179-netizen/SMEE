<?php
// Persistent single-workspace API. Serve through Apache or the PHP development server.
declare(strict_types=1);
ini_set('display_errors', '0');
date_default_timezone_set('Asia/Manila');
session_name('ledgerly_'.substr(hash('sha256',__DIR__.'|'.(getenv('LEDGERLY_DB_PATH') ?: 'workspace')),0,12));
ini_set('session.use_strict_mode', '1');
session_set_cookie_params(['httponly'=>true,'samesite'=>'Strict','secure'=>!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off','path'=>'/']);
session_start();
if(isset($_SESSION['last_seen']) && $_SESSION['last_seen']<time()-28800) {$_SESSION=[];session_regenerate_id(true);}
$_SESSION['last_seen']=time();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function fail(string $message, int $code=400): never { http_response_code($code); echo json_encode(['error'=>$message]); exit; }
function output($value): never { echo json_encode($value); exit; }
function textValue($value, int $max=160): string { if(!is_string($value) || trim($value)==='' || mb_strlen(trim($value))>$max) fail('Enter a valid text value (maximum '.$max.' characters).'); return trim($value); }
function amount($value): float { if(!is_numeric($value) || !is_finite((float)$value) || $value<0.01 || $value>999999999 || abs((float)$value-round((float)$value,2))>0.000001) fail('Amount must be between 0.01 and 999,999,999.'); return round((float)$value,2); }
function dateValue($value): string { if(!is_string($value)) fail('Invalid date.'); $d=DateTime::createFromFormat('!Y-m-d',$value); if(!$d || $d->format('Y-m-d')!==$value) fail('Invalid date.'); return $value; }
function choice($value,array $allowed): string { if(!in_array($value,$allowed,true)) fail('Invalid selection.'); return $value; }
try {
$db=new PDO('sqlite:'.(getenv('LEDGERLY_DB_PATH') ?: __DIR__.'/../data/ledgerly.sqlite'));
$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$db->exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
$db->exec('CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE COLLATE NOCASE, password TEXT NOT NULL, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS transactions(id INTEGER PRIMARY KEY, date TEXT NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL, status TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, name TEXT NOT NULL, amount REAL NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL, supplier_id INTEGER NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS invoices(id INTEGER PRIMARY KEY, ref TEXT NOT NULL, order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id), amount REAL NOT NULL, status TEXT NOT NULL, supplier_id INTEGER NOT NULL REFERENCES users(id), paid_date TEXT, UNIQUE(supplier_id,ref));
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(ip TEXT PRIMARY KEY, count INTEGER NOT NULL, started INTEGER NOT NULL);');
// Preserve existing accounts when upgrading from email-based sign-in.
$columns=$db->query('PRAGMA table_info(users)')->fetchAll(PDO::FETCH_COLUMN,1);
if(in_array('email',$columns,true) && !in_array('username',$columns,true)) $db->exec('ALTER TABLE users RENAME COLUMN email TO username');
function sql(string $query,array $args=[]): PDOStatement { global $db; $s=$db->prepare($query); $s->execute($args); return $s; }
$action=$_GET['action']??'state';
$method=$_SERVER['REQUEST_METHOD'];
$input=[];
if($method==='POST'){ $input=json_decode(file_get_contents('php://input'),true); if(!is_array($input)) fail('Invalid JSON.'); }
elseif($method!=='GET') fail('Method not allowed.',405);
$csrf=$_SESSION['csrf']??=bin2hex(random_bytes(32));
if($method==='POST' && !hash_equals($csrf,$_SERVER['HTTP_X_CSRF_TOKEN']??'')) fail('Session expired. Reload the page.',403);
if($action==='session' && $method==='GET') { $u=isset($_SESSION['uid'])?sql('SELECT id,name,username,role FROM users WHERE id=? AND active=1',[$_SESSION['uid']])->fetch(PDO::FETCH_ASSOC):false; output(['user'=>$u?:null,'csrf'=>$csrf,'setup'=>!(bool)sql('SELECT 1 FROM users LIMIT 1')->fetchColumn()]); }
if(in_array($action,['setup','login'],true)) {
 if($method!=='POST') fail('Method not allowed.',405);
 if($action==='setup') {
  $db->beginTransaction();
  if(sql('SELECT 1 FROM users LIMIT 1')->fetchColumn()) fail('Workspace already configured.',409);
  $name=textValue($input['name']??null); $username=textValue($input['username']??null); $password=$input['password']??'';
  if(!preg_match('/^[a-zA-Z0-9._@+\-]{3,160}$/',$username)) fail('Username must be 3–160 characters using letters, numbers, dots, underscores, @, + or hyphens.');
  if(!is_string($password)||strlen($password)<10||strlen($password)>200) fail('Use a password of 10–200 characters.');
  sql('INSERT INTO users(name,username,password,role) VALUES(?,?,?,?)',[$name,strtolower($username),password_hash($password,PASSWORD_DEFAULT),'Store Owner']);
  $uid=(int)$db->lastInsertId();
  sql('INSERT INTO settings(key,value) VALUES(?,?)',['workspace',json_encode(textValue($input['workspace']??null))]);
  $db->commit();
 } else {
  $ip=$_SERVER['REMOTE_ADDR']??'local'; $now=time(); $attempt=sql('SELECT * FROM attempts WHERE ip=?',[$ip])->fetch(PDO::FETCH_ASSOC);
  if($attempt && $attempt['started']>$now-900 && $attempt['count']>=10) fail('Too many attempts. Try again in 15 minutes.',429);
  $u=sql('SELECT * FROM users WHERE username=? AND active=1',[(string)($input['username']??'')])->fetch(PDO::FETCH_ASSOC);
  if(!$u || !is_string($input['password']??null) || !password_verify($input['password'],$u['password'])) {
   sql('INSERT INTO attempts(ip,count,started) VALUES(?,1,?) ON CONFLICT(ip) DO UPDATE SET count=CASE WHEN started<? THEN 1 ELSE count+1 END, started=CASE WHEN started<? THEN ? ELSE started END',[$ip,$now,$now-900,$now-900,$now]); fail('Username or password is incorrect.',401);
  }
  sql('DELETE FROM attempts WHERE ip=?',[$ip]); $uid=(int)$u['id'];
 }
 session_regenerate_id(true); $_SESSION['uid']=$uid; $_SESSION['csrf']=bin2hex(random_bytes(32)); output(['ok'=>true]);
}
$user=isset($_SESSION['uid'])?sql('SELECT id,name,username,role FROM users WHERE id=? AND active=1',[$_SESSION['uid']])->fetch(PDO::FETCH_ASSOC):false;
if(!$user) fail('Sign in to continue.',401);
$owner=$user['role']==='Store Owner'; $supplier=$user['role']==='Supplier'; $uid=(int)$user['id'];
function ownerOnly(): void { global $owner; if(!$owner) fail('Owner access required.',403); }
if($action==='state' && $method==='GET') {
 $transactions=$supplier?[]:sql('SELECT t.*,u.role AS "by" FROM transactions t JOIN users u ON u.id=t.user_id'.($owner?'':' WHERE user_id=?').' ORDER BY date DESC,t.id DESC',$owner?[]:[$uid])->fetchAll(PDO::FETCH_ASSOC);
 $orders=($owner||$supplier)?sql('SELECT o.*,u.name AS supplier FROM orders o JOIN users u ON u.id=o.supplier_id'.($owner?'':' WHERE supplier_id=?').' ORDER BY o.id DESC',$owner?[]:[$uid])->fetchAll(PDO::FETCH_ASSOC):[];
 $invoices=($owner||$supplier)?sql('SELECT i.*,o.name AS order_name FROM invoices i JOIN orders o ON o.id=i.order_id'.($owner?'':' WHERE i.supplier_id=?').' ORDER BY i.id DESC',$owner?[]:[$uid])->fetchAll(PDO::FETCH_ASSOC):[];
 $settings=[]; foreach(sql('SELECT * FROM settings')->fetchAll(PDO::FETCH_ASSOC) as $r) $settings[$r['key']]=json_decode($r['value'],true);
 if(!$owner) $settings=array_intersect_key($settings,['workspace'=>true]);
 output(['user'=>$user,'transactions'=>$transactions,'orders'=>$orders,'invoices'=>$invoices,'settings'=>$settings,'team'=>$owner?sql('SELECT id,name,username,role,active FROM users ORDER BY id')->fetchAll(PDO::FETCH_ASSOC):[]]);
}
if($method!=='POST') fail('Method not allowed.',405);
switch($action){
 case 'logout': $_SESSION=[]; session_destroy(); output(['ok'=>true]);
 case 'transaction':
  if($supplier) fail('Access denied.',403);
  sql('INSERT INTO transactions(date,name,category,type,amount,status,user_id) VALUES(?,?,?,?,?,?,?)',[dateValue($input['date']??null),textValue($input['name']??null),choice($input['category']??null,['Sales','Operations','Marketing','Payroll','Other']),choice($input['type']??null,['Income','Expense']),amount($input['amount']??null),$owner?'Completed':'Pending',$uid]); break;
 case 'review':
  ownerOnly(); $status=choice($input['status']??null,['Completed','Rejected']);
  $s=sql('UPDATE transactions SET status=? WHERE id=? AND status=?',[$status,$input['id']??0,'Pending']); if(!$s->rowCount()) fail('Submission already reviewed or missing.',409); break;
 case 'settings':
  ownerOnly(); $key=choice($input['key']??null,['workspace','budgets','checklist']); $value=$input['value']??null;
  if($key==='workspace') $value=textValue($value);
  if($key==='budgets'){if(!is_array($value)||count($value)!==4) fail('Four budgets required.'); $value=array_map(fn($v)=>$v===0||$v==='0'?0:amount($v),array_values($value));}
  if($key==='checklist'){if(!is_array($value)||count($value)!==3) fail('Invalid checklist.'); $value=array_map(fn($v)=>(bool)$v,array_values($value));}
  sql('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[$key,json_encode($value)]); break;
 case 'user':
  ownerOnly(); $username=textValue($input['username']??null); $password=$input['password']??'';
  if(!preg_match('/^[a-zA-Z0-9._@+\-]{3,160}$/',$username)) fail('Username must be 3–160 characters using letters, numbers, dots, underscores, @, + or hyphens.');
  if(!is_string($password)||strlen($password)<10||strlen($password)>200) fail('Use a password of 10–200 characters.');
  sql('INSERT INTO users(name,username,password,role) VALUES(?,?,?,?)',[textValue($input['name']??null),strtolower($username),password_hash($password,PASSWORD_DEFAULT),choice($input['role']??null,['Staff','Supplier'])]); break;
 case 'access':
  ownerOnly(); $s=sql('UPDATE users SET active=? WHERE id=? AND role<>?',[(int)(bool)($input['active']??false),$input['id']??0,'Store Owner']); if(!$s->rowCount()) fail('Account not found.'); break;
 case 'password':
  $hash=sql('SELECT password FROM users WHERE id=?',[$uid])->fetchColumn();
  if(!password_verify((string)($input['current']??''),$hash)) fail('Current password is incorrect.');
  $password=$input['password']??''; if(!is_string($password)||strlen($password)<10||strlen($password)>200) fail('Use a password of 10–200 characters.');
  sql('UPDATE users SET password=? WHERE id=?',[password_hash($password,PASSWORD_DEFAULT),$uid]); session_regenerate_id(true); break;
 case 'order':
  ownerOnly(); if(!sql('SELECT id FROM users WHERE id=? AND role=? AND active=1',[$input['supplier_id']??0,'Supplier'])->fetchColumn()) fail('Select an active supplier.');
  sql('INSERT INTO orders(name,amount,date,status,supplier_id) VALUES(?,?,?,?,?)',[textValue($input['name']??null),amount($input['amount']??null),dateValue($input['date']??null),'Awaiting confirmation',$input['supplier_id']]); break;
 case 'order_status':
  if(!$supplier) fail('Supplier access required.',403); $status=choice($input['status']??null,['Confirmed','Delivered']); $prior=$status==='Confirmed'?'Awaiting confirmation':'Confirmed';
  $s=sql('UPDATE orders SET status=? WHERE id=? AND supplier_id=? AND status=?',[$status,$input['id']??0,$uid,$prior]); if(!$s->rowCount()) fail('Order is missing or its status changed.',409); break;
 case 'invoice':
  if(!$supplier) fail('Supplier access required.',403);
  $o=sql('SELECT * FROM orders WHERE id=? AND supplier_id=? AND status=?',[$input['order_id']??0,$uid,'Delivered'])->fetch(PDO::FETCH_ASSOC); if(!$o) fail('Choose one of your delivered orders.');
  sql('INSERT INTO invoices(ref,order_id,amount,status,supplier_id) VALUES(?,?,?,?,?)',[textValue($input['ref']??null),$o['id'],$o['amount'],'Under review',$uid]); break;
 case 'pay':
  ownerOnly(); $db->beginTransaction();
  $i=sql('SELECT i.*,o.name FROM invoices i JOIN orders o ON o.id=i.order_id WHERE i.id=? AND i.status=?',[$input['id']??0,'Under review'])->fetch(PDO::FETCH_ASSOC); if(!$i) fail('Invoice is missing or already paid.',409);
  $date=dateValue($input['date']??null);
  sql('UPDATE invoices SET status=?,paid_date=? WHERE id=?',['Paid',$date,$i['id']]); sql('UPDATE orders SET status=? WHERE id=?',['Paid',$i['order_id']]);
  sql('INSERT INTO transactions(date,name,category,type,amount,status,user_id) VALUES(?,?,?,?,?,?,?)',[$date,'Supplier payment: '.$i['ref'].' · '.$i['name'],'Operations','Expense',$i['amount'],'Completed',$uid]); $db->commit(); break;
 default: fail('Unknown action.',404);
}
output(['ok'=>true]);
} catch(PDOException $e){ if(isset($db)&&$db->inTransaction())$db->rollBack(); if($e->getCode()==='23000') fail('This username, invoice number, or order invoice already exists.',409); error_log((string)$e); fail('Database operation failed. Please try again.',500); }
catch(Throwable $e){ if(isset($db)&&$db->inTransaction())$db->rollBack(); error_log((string)$e); fail('Unable to process request.',500); }




