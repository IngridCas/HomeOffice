<?php

if (strpos(getcwd(),'php') !== false){
    require_once ("../model/conexion.php");
}else{
	require_once ("php/model/conexion.php");
}

class asorteo
{
    public function __construct(){

    }
    public function __destruct(){

    }
	
	public function getNumero(){
		$data = array();       
	    $objConection = new Conexion();
		
		//$sql = "SELECT par1, par2, par3, par4, par5 FROM loto_sorteos WHERE juego = 10 ORDER BY fecha DESC LIMIT 1;";
		
		$sql = "SELECT nganador, nsorteo FROM huembes_sorteo ORDER BY fecha DESC LIMIT 1;";
		
		$result = $objConection->query($sql);

		/*while ($row = mysqli_fetch_array($result,MYSQLI_NUM)) 
	        { 
	            array_push($data, $row);
	        }
		*/
		$row = $result->fetch_row();
		
	    $objConection->closeresult($result); 
	    $objConection->closeConection(); 
				
	    return $row;
	}
	
	public function getAcumulado(){     
	    $objConection = new Conexion();
		
		$sql = "SELECT acumulado, nsorteo FROM huembes_acumulado ORDER BY acumuladoid DESC LIMIT 1;";
		
		$result = $objConection->query($sql);

		$row = $result->fetch_row();
		
	    $objConection->closeresult($result); 
	    $objConection->closeConection(); 
				
	    return $row;
	}
	
	public function getSorteoGanador(){
	    $objConection = new Conexion();
		
		$sql = "SELECT nganador, nombreagente, premio, nsorteo FROM huembes_sorteo ORDER BY sorteoid DESC LIMIT 1;";
		
		$result = $objConection->query($sql);

		$row = $result->fetch_row();
		
	    $objConection->closeresult($result); 
	    $objConection->closeConection(); 
				
	    return $row;
	}
}

?>