<?php
//<link href="css/sections.css" rel="stylesheet">
header("Expires: Mon, 26 Jul 1997 05:00:00 GMT"); // Date in the past
header("Last-Modified: " . gmdate("D, d M Y H:i:s") . " GMT"); // Always modified
header("Cache-Control: private, no-store, no-cache, must-revalidate"); // HTTP/1.1
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache"); // HTTP/1.0
header('Content-Type: text/html; charset=utf-8');

date_default_timezone_set('America/Managua');

$json = file_get_contents("https://juega.loto.com.ni/websales/?action=gamesdata&");
$data = json_decode($json, true)["El Acumulado"]["Next Draw"]["draws"];

$drawnumber = $data["drawnumber"];
$jackpot = $data["jackpot"];
?>
<!DOCTYPE html>
<html lang="es">
<head>
<title><?php echo 'Acumulado' ?></title>
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
		font-family: "HelveticaRounded Bold";
		color: white;
	}
	/**** CSS Acumulado ****/
	div#sorteoid-acum{
		font-size: 50px;
		margin-top: 0px;
	}
	
	.contenedorAcumulado {
		height: 540px;
		width: 960px;
		background-image: url("../img/BG_acumulado.gif");
		background-size: 100% ;
		background-repeat: no-repeat;
	}
	
	.card-number-acum {
		margin : 5px;
		padding : 10px;
	    background: none;
	    border-radius: 5px;
	    font-size: 135px;
	    color: white;
		width: 100%;
		text-align: center;
	}
	
	.centered-number-acum {
	    display: inline-block;
		vertical-align: middle;
		width: 780px;
		height: 455px;
		padding-top: 130px;
		padding-left: 215px;
	}
/**** Fin CSS Acumulado ****/
</style>

<!--Bootstrap-->
<link rel="stylesheet" href="../css/bootstrap.min.css">
</head>

<body>
<div class="contenedorAcumulado">
	<div class="centered-number-acum">
		<div class="row">
			<div class="card-number-acum">
				<span id="nGanador" class="">-</span>
			</div>
		</div>
		<div class="row">
			<div id="sorteoid-acum" class="card-number-acum">
				<span id="nSorteo-acum" class="">    1</span>
			</div>
		</div>
	</div>
</div>
<script>

$(function() {
	
	
		$({monto: 0}).animate({monto: <?php echo $jackpot;?>}, {
	      duration: 3000,
	      easing:'swing',
	      step: function() {
	          $('#nGanador').text(commaSeparateNumber(Math.round(this.monto)));
	      },
	      complete:function(){
	          $('#nGanador').text(commaSeparateNumber(Math.round(this.monto)));
	      }
	  });
	  
	  $("#nSorteo-acum").text(pad(<?php echo $drawnumber;?>,5));
	  
	
	 function commaSeparateNumber(val){
	    while (/(\d+)(\d{3})/.test(val.toString())){
	      val = val.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
	    }
	    return val;
	  }
	  
	  function pad (str, max) {
		  str = str.toString();
		  return str.length < max ? pad(" " + str, max) : str;
		}
  });
</script>
</body>
</html>