<?php

function consultarNumero(){
	require_once("../access/asorteo.php");
	
	$sorteo = new asorteo();
	$numero = $sorteo->getNumero();
	//$huembes ='{ 	"El Acumulado Del Huembes": {	"Whole week": {	"gamename": "El Acumulado Del Huembes",	"draws": {	"Monday": {	"13:00": {	"result": ["", "", "", "", ""],	"drawnumber": "",	"date": ""	}	},	"Tuesday": {	"13:00": {	"result": ["", "", "", "", ""],	"drawnumber": "",	"date": ""	}	},	"Wednesday": {	"13:00": {	"result": ["", "", "", "", ""],	"drawnumber": "",	"date": ""	}	},	"Thursday": {	"13:00": {	"result": ["", "", "", "", ""],	"drawnumber": "",	"date": ""	}	},	"Friday": {	"13:00": {	"result": ["", "", "", "", ""],	"drawnumber": "",	"date": ""	}	},	"Saturday": {	"13:00": {	"result": ["", "", "", "", ""],	"drawnumber": "",	"date": ""	}	},	"Sunday": {	"13:00": {	"result": ["", "", "", "", ""],	"drawnumber": "",	"date": ""	}	}	},	"order": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]	},	"Last week": {	"gamename": "El Acumulado Del Huembes",	"draws": {	"Monday": {	"13:00": {	"result": ["", "", "", "", ""],	"drawnumber": "",	"date": ""	}	},	"Tuesday": {	"13:00": {	"result": ["", "", "", "", ""],	"drawnumber": "",	"date": ""	}	},	"Wednesday": {	"13:00": {	"result": ["", "", "", "", ""],	"drawnumber": "",	"date": ""	}	},	"Thursday": {	"13:00": {	"result": ["", "", "", "", ""],	"drawnumber": "",	"date": ""	}	},	"Friday": {	"13:00": {	"result": ["", "", "", "", ""],	"drawnumber": "",	"date": ""	}	},	"Saturday": {	"13:00": {	"result": ["", "", "", "", ""],	"drawnumber": "",	"date": ""	}	},	"Sunday": {	"13:00": {	"result": ["", "", "", "", ""],	"drawnumber": "",	"date": ""	}	}	},	"order": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]	},	"Last two draws": {	"gamename": "El Acumulado Del Huembes",	"draws": {	"Last Draw": {	"result": ["5", "3", "2", "1", "7"],	"drawnumber": 1,	"date": 1556209440,	"jackpot": 5400.0	},	"Penultimate": {	"result": ["", "", "", "", ""],	"drawnumber": "",	"date": ""	}	},	"order": ["Last Draw", "Penultimate"]	},	"Next Draw": {	"gamename": "El Acumulado Del Huembes",	"draws": {	"result": null,	"drawnumber": 2,	"date": 1556650800,	"jackpot": 8100.0	}	},	"Today Draws": {	"gamename": "El Acumulado Del Huembes",	"draws": {	"13:00": {	"result": ["8", "5", "3", "7", "1"],	"drawnumber": "",	"date": ""	}	},	"order": ["13:00"]	},	"Yesterday Draws": {	"gamename": "El Acumulado Del Huembes",	"draws": {	"13:00": {	"result": ["", "", "", "", ""],	"drawnumber": "",	"date": ""	}	},	"order": ["13:00"]	} 	} }';
	//echo json_encode($numero);
	//echo json_encode($huembes);
	$post = ['number'=>$numero[0], 'sorteo'=>$numero[1]];
	echo json_encode($post);
}

function consultarAcumulado(){
	require_once("../access/asorteo.php");
	
	$sorteo = new asorteo();
	$numero = $sorteo->getAcumulado();
	//echo $numero[0];
	$post = ['acumulado'=> $numero[0], 'nsorteo'=>$numero[1]];
	echo json_encode($post);
}

function getSorteoGanador(){
	require_once("../access/asorteo.php");
	
	$sorteo = new asorteo();
	$data = $sorteo->getSorteoGanador();
	$post = ['nganador'=> $data[0], 'agente'=> $data[1], 'premio'=> $data[2], 'sorteo'=> $data[3]];
	echo json_encode($post);
}


if($_SERVER['REQUEST_METHOD'] === 'POST'){
	
    switch ($_POST['method'])
    {
        case 'getNumberHuembes':
			consultarNumero();
        break;
        case 'getAcumulado':
			consultarAcumulado();
        break;
		case 'getSorteoGanador':
			getSorteoGanador();
		break;
	}
    
}/*elseif($from_section === "section") {
	require_once("php/access/...php");
	printsection();
	return;
}*/
?>