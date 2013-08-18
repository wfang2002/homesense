#ifndef SHT11_H
#define SHT11_H

#define SHT11_SCK	PIN_C7
#define SHT11_DATA	PIN_C6

void SHT11_Start()
{
	output_low(SHT11_SCK);
	delay_us(2);
    output_float(SHT11_DATA); //I2C DDATA do H pres pullup odpor
	delay_us(2);
	output_high(SHT11_SCK);
	delay_us(2);
	output_low(SHT11_DATA);
	delay_us(2);
	output_low(SHT11_SCK);
	delay_us(2);
	output_high(SHT11_SCK);
	delay_us(2);
    output_float(SHT11_DATA); //I2C DDATA do H pres pullup odpor
	delay_us(2);
	output_low(SHT11_SCK);

}

char SHT11_ReadByte(int ack)
{
	char i,val=0;
        output_float(SHT11_DATA);
      	val=0;
      	for (i=0;i<8;i++)        // rotujici maskovaci bit
      	{
		delay_us(2);
		output_high(SHT11_SCK);
		delay_us(2);
            	val= val<<1;
            	val += input(SHT11_DATA);
		output_low(SHT11_SCK);
      	}

      	if (ack)
      	{
		output_low(SHT11_DATA);
      	};
	delay_us(2);
	output_high(SHT11_SCK);
      	delay_us(5);
        output_float(SHT11_DATA); //I2C DDATA do H pres pullup odpor
	output_low(SHT11_SCK);
	return val;

}

long SHT11_ReadLong(){
 byte i, ByteHigh=0, ByteLow=0;
 long Lx;

  for(i=1;i<=8;++i){                     // read high byte VALUE from SHT11
     output_high(SHT11_SCK);
     delay_us(2);
     shift_left(&ByteHigh,1,input(SHT11_DATA));
     output_low(SHT11_SCK);
     delay_us(2);
  }
  output_low(SHT11_DATA);
       delay_us(2);
  output_high(SHT11_SCK);
  delay_us(2);
  output_low(SHT11_SCK);
  output_float(SHT11_DATA);
  delay_us(2);

  for(i=1;i<=8;++i){                     // read low byte VALUE from SHT11
     output_high(SHT11_SCK);
     delay_us(2);
     shift_left(&ByteLow,1,input(SHT11_DATA));
     output_low(SHT11_SCK);
     delay_us(2);
  }
  output_high(SHT11_DATA);
       delay_us(2);
  output_high(SHT11_SCK);
  delay_us(2);
  output_low(SHT11_SCK);
  output_float(SHT11_DATA);
  delay_us(2);
  Lx=make16(ByteHigh,ByteLow);
  return(Lx);
}

void SHT11_SendByte(byte nData)
{
	char i;

      	for (i=0x80;i>0;i/=2)              // rotujici maskovaci bit
      	{
      		if (i & nData)
        		output_float(SHT11_DATA); //I2C DDATA do H pres pullup odpor
            	else
			output_low(SHT11_DATA);
		delay_us(2);
		output_high(SHT11_SCK);
      		delay_us(5);
		output_low(SHT11_SCK);
      }
        output_float(SHT11_DATA); //I2C DDATA do H pres pullup odpor
	delay_us(2);
      	i = input(SHT11_DATA);            // kontrola ACK (sensor stahne pin do 0
	output_high(SHT11_SCK);
	delay_us(2);
	output_low(SHT11_SCK);
	//if(i)
	//	printf("SHT11 send error\n");
}

//nMode 0:Temperature, 1:Humidity
long SHT11_Measure(int nMode)
{
 	int i;
 	long val;

	SHT11_Start();
	switch(nMode){
	case 0: //Temperature
		SHT11_SendByte(3);
		break;
	case 1://Humidity
		SHT11_SendByte(5);
		break;
	default :
		break;
	}
	for (i=0;i<150;i++)
	{
		delay_ms(2);
		if(!input(SHT11_DATA))
			break;
	};
	val = SHT11_ReadLong();
	//val = SHT11_ReadByte(1);
	//val = (val << 8) + SHT11_ReadByte(1);
	//checksum =SHT11_ReadByte(0);
	return val;
}

#endif
