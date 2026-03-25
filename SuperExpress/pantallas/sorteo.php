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
<title><?php echo 'Sorteo' ?></title>
<meta name="description" content="<?php echo 'Sorteo'?>" />
<meta charset="UTF-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
<meta name="viewport" content="width=device-width,initial-scale=1" />

<script type="text/javascript" src="../js/jquery-1.7.min.js"></script>
<script type="text/javascript" src="../js/jquery.animateNumber.js"></script>

<!--<link rel="stylesheet" href="../css/main.css">-->
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

	/**** CSS Sorteo ****/
	div#sorteoid-sor{
		font-size: 50px;
		margin-top: 50px;
		margin-left: 70px;
	}
	.card-number-sor {
		background: none;
		font-size: 100px;
		color: white;
		width: 85px !important;
		text-align: center;
	}
	
	.contenedorSorteo {
		height: 540px;
		width: 960px;
		background-image: url("../img/BG_sorteo.gif");
		background-size: 100% ;
		background-repeat: no-repeat;
	}
	
	.centered-number-sor {
	  display: inline-block;
	  vertical-align: middle;
	  padding-top: 70px;
	  padding-left: 323px;
	}
	
	div#dAgente {
		padding-top: 90px;
		padding-left: 245px;
		font-size: 40px;
		width: 785px;
		text-align: center;
		letter-spacing: -3px;
	}
	
	div#dPremio {
		margin-top: -10px;
		padding-left: 420px;
		font-size: 60px;
	}
/**** Fin CSS Sorteo ****/
</style>

<!--Bootstrap-->
<link rel="stylesheet" href="../css/bootstrap.min.css">
</head>

<body>
<div class="contenedorSorteo">
	<div class="centered-number-sor">
		<div class="row">
			<div class="card-number-sor">
				<span id="d0" >-</span>
			</div>
			<div class="card-number-sor">
				<span id="d1" >-</span>
			</div>
			<div class="card-number-sor">
				<span id="d2" >-</span>
			</div>
			<div class="card-number-sor">
				<span id="d3" >-</span>
			</div>
			<div class="card-number-sor">
				<span id="d4" >-</span>
			</div>
			<div id="sorteoid-sor">
				<pre id="nSorteo-sor">00000</pre>
			</div>
		</div>
	</div>
	<div >
		<div id="dAgente">
			<span id="agente">Agente vendedor</span>
		</div>
	</div>
	<div id="dPremio">
		<div>
			<span id="premio">C$ 00</span>
		</div>
	</div>
</div>
<script>

$(function() {
	
	$.post("../php/business/bsorteo.php",{method:'getSorteoGanador'},function(data){
		
		var response = JSON.parse(data);
		
		var numero = response['nganador'].split("");
		$("#d0").text(numero[0]);
		$("#d1").text(numero[1]);
		$("#d2").text(numero[2]);
		$("#d3").text(numero[3]);
		$("#d4").text(numero[4]);
		
		$("#agente").text(response['agente']);
		$("#premio").text(('C$ ' + parseInt(response['premio'])).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,"));
		$("#nSorteo-sor").text(pad(response['sorteo'],5));		
  	});
  	
  	function pad (str, max) {
	  str = str.toString();
	  return str.length < max ? pad(" " + str, max) : str;
	}
		
  });
</script>
</body>
</html>