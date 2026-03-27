<?php
class Conexion{
    private $conection;

	public function __construct()
	{
		//Local		
		$this->conection = mysqli_connect('localhost', 'root', 't000r', 'lotoni');		
		
		if(!$this->conection)
		{
                    print("Connection Failed.");

		}

	}
	
	public function query($sql){
		$result = mysqli_query($this->conection, $sql);
		return $result;
	}

	public function closeresult($data){
		mysqli_free_result($data);
	}

	public function next($data){
		$list = mysqli_fetch_all($data);
		return $list;
	}

	public function execute($sql){
		return mysqli_query($this->conection, $sql);
	}

	public function closeConection(){
		mysqli_close($this->conection);
	}
	public function __destruct(){
		
	}
}
?>