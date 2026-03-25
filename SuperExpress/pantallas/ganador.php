<?php

//<link href="css/sections.css" rel="stylesheet">
header("Expires: Mon, 26 Jul 1997 05:00:00 GMT"); // Date in the past
header("Last-Modified: " . gmdate("D, d M Y H:i:s") . " GMT"); // Always modified
header("Cache-Control: private, no-store, no-cache, must-revalidate"); // HTTP/1.1
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache"); // HTTP/1.0
header('Content-Type: text/html; charset=utf-8');

?>
<!DOCTYPE html>
<html lang="es">
<head>
<title><?php echo 'Numero aleatorio' ?></title>
<meta name="description" content="<?php echo 'Sorteo'?>" />
<meta charset="UTF-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
<meta name="viewport" content="width=device-width,initial-scale=1" />

<script type="text/javascript" src="../js/jquery-1.7.min.js"></script>
<script type="text/javascript" src="../js/jquery.animateNumber.js"></script>

<!--<link rel="stylesheet" href="css/main.css">-->
<style>
	@font-face {
	  font-family: LotoFont;
	  src: url("../font/HelveticaRounded-Bold.otf");
	}
	span {
		text-align: center;
		font-family: LotoFont;
		color: white;
	}
	
	pre#nSorteo-sor{
		text-align: right;
		font-family: LotoFont;
		color: white;
	}
	/**** CSS Numero aleatorio ****/
	div#sorteoid {
		font-size: 50px;
		width: 100%;
		margin-top: 95px;
		margin-left: 30px;
	}
	
	.card-number {
		margin: 3px;
		padding: 5px;
		background: none;
		border-radius: 5px;
		font-size: 155px;
		color: white;
		width: 105px;
		text-align: center;
	}
	
	.contenedor {
		height: 540px;
		width: 960px;
		background-image: url("../img/background.gif");
		background-size: 100% ;
		background-repeat: no-repeat;
	}
	
	.centered-number {
		display: inline-block;
		vertical-align: middle;
		width: 770px;
		height: 280px;
		padding-top: 125px;
		padding-left: 233px;
	}
/**** Fin CSS Numero Aleatorio ****/
</style>

<!--Bootstrap-->
<link rel="stylesheet" href="../css/bootstrap.min.css">
</head>

<body>
<div class="contenedor">
	<div class="centered-number">
		<div class="row">
			<div class="card-number">
				<span id="d0" class="">-</span>
			</div>
			<div class="card-number">
				<span id="d1" >-</span>
			</div>
			<div class="card-number">
				<span id="d2" >-</span>
			</div>
			<div class="card-number">
				<span id="d3" >-</span>
			</div>
			<div class="card-number">
				<span id="d4" >-</span>
			</div>
		</div>
	</div>
	<div class="row">
		<div id="sorteoid" class="card-number">
			<span id="dSorteo" class="">0000</span>
		</div>
	</div>
</div>
<script>

$(function() {
	
	$.post("../php/business/bsorteo.php",{method:'getNumberHuembes'},function(data){
		
		var response = JSON.parse(data);
		
		var sorteid = response['sorteo'];
		
		$("#dSorteo").text(pad(sorteid,5));
		
		var numbers = response['number'].split("");
		
		var intervals = new Array(5);
		
		for(var i=0; i<5;i++){
			var output = $('#d' + i);
			createAnimation(output,i);
		}
			
		function createAnimation(item, index){
			intervals[index] = setInterval(function() {
					item.text('' + Math.floor(Math.random() * 10))
				}, 100);
		}
			
		function generateNumber(index) {
		clearInterval(intervals[index]);
		
		  var desired = numbers[index];
		  var duration = 5000;
	
		  var output = $('#d' + index);
		  var started = new Date().getTime();
	
		  animationTimer = setInterval(function() {
			if (new Date().getTime() - started > duration) {
			  clearInterval(animationTimer);		  
			  output.text(desired);
			  generateNumber(index + 1);
			} else {
			  output.text('' + Math.floor(Math.random() * 10)
			  );
			}
		  }, 100);
		}
	
		generateNumber(0);
		
		function pad (str, max) {
		  str = str.toString();
		  return str.length < max ? pad(" " + str, max) : str;
		}
	
	
  });
  });
</script>
</body>
</html>