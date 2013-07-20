
#include <18F4550.h>
#device adc=10
#use delay(clock=48000000) 

#include "..\share\bootloader.h"

//Configure a 4MHz crystal
#fuses HSPLL,NOWDT,NOPROTECT,NOLVP,NODEBUG,USBDIV,PLL1,CPUDIV1,VREGEN
//#use rs232(baud=19200,parity=N,xmit=PIN_C6,rcv=PIN_C7)
#use I2C(master, sda=PIN_B4, scl=PIN_B5, FAST, stream = local_master)

#use I2C(slave, address=0x3A, sda=PIN_B0, scl=PIN_B1, FORCE_HW, FAST, stream = dut_slave)


// Includes all USB code and interrupts, as well as the CDC API
#include "..\share\usb_cdc.h"
#include <stdlib.h>

#define PIN_LED PIN_C2
#define PIN_DUT_PWR	PIN_C1
#define PIN_RST	PIN_B3
#define PIN_INT	PIN_B2

#define MAX_CMD_LEN	32
#define END_OF_CMD	0x0D
#define CMD_FIX_LEN	3

#byte PIR2=0xFA1
#bit TMR3IF=PIR2.1

#byte SSPBUF=0xFC9
#byte SSPADD=0xFC8
#byte SSPSTAT=0xFC7
#byte SSPCON1=0xFC6
#byte SSPCON2=0xFC5
#bit 	WCOL =	SSPCON1.7
#bit	SSPOV =	SSPCON1.6
#bit	SSPEN =	SSPCON1.5
#BIT	CKP =		SSPCON1.4
#BIT	SSPM3 =	SSPCON1.3
#BIT	SSPM2 =	SSPCON1.2
#BIT	SSPM1 =	SSPCON1.1
#BIT	SSPM0 =	SSPCON1.0
#BIT	GCEN =	SSPCON2.7
#BIT	ACKSTAT=SSPCON2.6
#BIT	ACKDT = SSPCON2.5
#BIT	ACKEN = SSPCON2.4
#BIT	RCEN = 	SSPCON2.3
#BIT	PEN =		SSPCON2.2
#BIT	RSEN =	SSPCON2.1
#BIT	SEN = 	SSPCON2.0

#define LED_ON	output_low(PIN_LED)
#define LED_OFF	output_high(PIN_LED)

#define NAVISCROLL_CLOCK	1

const char sVersion[] = "BTUSBKB3 4.32";

char sCommand[MAX_CMD_LEN];
int nCmdLen=0;
int bCommandReady;
int g_bDebug=0;
enum{
	CMD_VER,	//Get version
	CMD_PGM,	//Enter program mode
	CMD_SWO,	//Open switch
	CMD_SWC,	//Close switch
	CMD_SWP,	//PWM switch, e.g. SWT SW1,3,80,200 - close switch SW1 for 80ms, then open for 200ms, repeat 3 times
	CMD_NVS,	//Naviscroll command
	CMD_ADC,	//Single sample
	CMD_RST,	//Set zero current
	CMD_SMP,	//Continuous sample
	CMD_VCL,	//Calibrate voltage
	CMD_CCL,	//Calibrate current
	CMD_RAW,	//Show raw ADC value
	CMD_IOL,	//Set IO pin low
	CMD_IOH,	//Set IO pin high
	CMD_INP,	//input IO pin status (1: High, 0:Low)
	CMD_REG,	//Show register value
	CMD_SIM,	//SIM Card switch
	CMD_USB,	//USB port switch
	CMD_DBG,	//Turn on/off debug output
	CMD_ACC,	//Accelerometer Sensor. Format ACC X,Y,Z e.g. ACC 0,0,64
	CMD_NUM		//Must be the last item

};

const char sCmdStrings[CMD_NUM][4] = 
{
	"VER",
	"PGM",
	"SWO",
	"SWC",
	"SWP",
	"NVS",
	"ADC",
	"RST",
	"SMP",
	"VCL",
	"CCL",
	"RAW",
	"IOL",
	"IOH",
	"INP",
	"REG",
	"SIM",
	"USB",
	"DBG",
	"ACC"
};

int16 InputPin(char *sPort);

int16 nLIS302SampleTimer = 10;	//default 100Hz,
int nLEDTimer = 200; //200ms

int bSample=0;

#define ADDRESS_CONFIG 0
struct
{
	int16 nID;	//Shall be 0x55AA if initiated
	float fVolRate;
	signed int16 nVolOffset;
	float fCurRate100;	//0~100mA calibration rate
	float fCurRate1000;	//100mA~1A calibration rate
	float fCurRateHigh;	//1A~3A calibration rate
	signed int16 nCurOffset;
	float fTmpRate; 	//Temperature compensation rate, around 2mA/C
	float fTmpBase;
	int16 nTimerBase;	//1ms timer preset value
}Config;

//LIS302DL register map
#define LIS302DL_CTRL1	0x20
#define LIS302DL_CTRL2	0x21
#define LIS302DL_CTRL3	0x22
#define LIS302DL_STATUS	0x27
#define LIS302DL_OUTX	0x29
#define LIS302DL_OUTY	0x2B
#define LIS302DL_OUTZ	0x2D
const BYTE LIS302DL_Address = 0x3A;
BYTE i2c_regaddr=0, LIS302DL_REG[0x40]={
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x3B,
0x20, 0x8B, 0xA7, 0x12, 0x13, 0x03, 0x11, 0x83,  0x00, 0xD3, 0x0C, 0x01, 0x00, 0x00, 0x00, 0x00,
0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0F,  0x00, 0x00, 0x00, 0x00, 0x00, 0xC4, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00};

//ADXL340 register map
#define ADXL340_WHOAMI	0x0F	//Device identification ID
#define ADXL340_STATUS	0x10	//Device status bit
#define ADXL340_INTSOURCE	0x11	//Interrupt source
#define ADXL340_CTL			0x12	//Device control register
#define ADXL340_INTCONTROL	0x13	//Interrupt control/Configuration register
#define ADXL340_INTCONTROL2	0x14	//Interrupt control/Configuration register 2
#define ADXL340_DATAX	0x15	//Data from x-axis
#define ADXL340_DATAY	0x16	//Data from y-axis
#define ADXL340_DATAZ	0x17	//Data from z-axis
#define ADXL340_THRESHG	0x1C	//Common threshold register
#define ADXL340_THRESHC	0x1D	//Tap threshold register
#define ADXL340_OFSX	0x1E		//x-axis offset register
#define ADXL340_OFSY	0x1F		//y-axis offset register
#define ADXL340_OFSZ	0x20		//z-axis offset register
#define ADXL340_DUR		0x21		//Tap duration register
#define ADXL340_LATENT	0x22	//Tap latency register
#define ADXL340_INTVL	0x23		//Tap interval register
const BYTE ADXL340_Address = 0x3A;	//The same I2C address as LIS302DL
BYTE ADXL340_REG[0x40]={
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x4A,
0x00, 0x00, 0x00, 0x12, 0x13, 0x03, 0x11, 0x83,  0x00, 0xD3, 0x0C, 0x01, 0x00, 0x00, 0x00, 0x00,
0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0F,  0x00, 0x00, 0x00, 0x00, 0x00, 0xC4, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00};


char sACCINT1Port[5] = "SW6";
char sACCINT2Port[5] = "SW7";
byte g_bACCEn=1;	//1: Enable accelerometer function
byte g_nACCType=0;	//0: LIS302DL, 1:ADXL340

BYTE *ACC_REG = LIS302DL_REG;
long i2c_readcount = 0;

BYTE bI2C_read=0;
BYTE bI2C_write=0;
BYTE nI2C_readAddr=0;
BYTE nI2c_readData=0;
BYTE nI2C_writeAddr=0;
BYTE nI2C_writeData=0;

#INT_SSP
void ssp_interupt ()
{
   BYTE incoming, state;

	state = i2c_isr_state();
	
	nLEDTimer = 20;
	
	if(!g_bAccEn)	//Accelerometer function disabled
		return;

	if(state < 0x80)							//Master is sending data
	{
		if(state > 0)
			incoming = i2c_read(dut_slave);

		if(state == 1)							//First received byte is address
		{
			i2c_regaddr = incoming;
			i2c_regaddr&=0x3F;
			
		}
		else if(state >= 2)							//Second and more received byte is data
		{
				//for accelerometer debug
				bI2c_write = 1;
				nI2C_writeAddr = i2c_regaddr;
				nI2C_writeData = incoming;
				
				ACC_REG[i2c_regaddr++] = incoming;
				
		}

	}
	if(state >= 0x80)							//Master is requesting data
	{
			//for accelerometer debug
			bI2c_read = 1;
			nI2C_readAddr = i2c_regaddr;
			nI2C_readData = ACC_REG[i2c_regaddr];
			
			i2c_write(dut_slave, ACC_REG[i2c_regaddr++]);
			i2c_readcount++;
	}
}

//1ms interrupt
#int_TIMER3
void TIMER3_isr() 
{
	//	set_timer3(5560);	//10ms
	set_timer3(Config.nTimerBase); 	//1ms interrupt

	if(nLEDTimer)
		nLEDTimer--;

	if(nLIS302SampleTimer)
	{
			nLIS302SampleTimer--;
	}
	else
		nLIS302SampleTimer = 10;	//100Hz
}

#define ADG2128_ADDRESS 0xE0

//nX range: 0~11, nY range: 0~7
//nState: 0=Open, 1=Close
void WriteADG2128(int nX, int nY, int nState)
{
	int nCmd1, nCmd2;
	
	if(nX > 5)
		nX += 2;
	nCmd1 = nX;
	nCmd1 <<= 3;
	nCmd1 |= nY;
	if(nState)
		nCmd1 |= 0x80;

	i2c_start(local_master);
	i2c_write(local_master, ADG2128_ADDRESS);
	i2c_write(local_master, nCmd1);
	i2c_write(local_master, 0x01);
	i2c_stop(local_master);
}

void ResetADG2128()
{
	output_low(PIN_RST);
	delay_ms(10);
	output_high(PIN_RST);
}

#define PCA9535_ADDRESS	0x4E
int nPortConfig[2];	//bit=1: Input, 0:output
int nPortState[2];

//nSw: Switch# from 0~15
//nState: 0:Low, 1:High, 2:Float
void WritePCA9535(int nSw, int nState)
{
	int nCmd, nData;
	int nPortIdx, nBitIdx;
	nPortIdx = nSw/8;
	nBitIdx = nSw%8;

	if(nState == 2) //Set IO to input (float)
		bit_set(nPortConfig[nPortIdx], nBitIdx);
	else
	{
		bit_clear(nPortConfig[nPortIdx], nBitIdx);
		if(nState == 0)
			bit_clear(nPortState[nPortIdx], nBitIdx);
		else
			bit_set(nPortState[nPortIdx], nBitIdx);
	}

	i2c_start(local_master);
	i2c_write(local_master, PCA9535_ADDRESS);
	i2c_write(local_master, 0x06+nPortIdx); //Configure port
	i2c_write(local_master, nPortConfig[nPortIdx]);
	i2c_stop(local_master);

	i2c_start(local_master);
	i2c_write(local_master, PCA9535_ADDRESS);
	i2c_write(local_master, 0x02 + nPortIdx); //Configure port 1
	i2c_write(local_master, nPortState[nPortIdx]);
	i2c_stop(local_master);
}

//Return port status
//nSw: Switch# 0~15
int ReadPCA9535(int nSw)
{
	int nData = 0;
	int nPortIdx, nBitIdx;
	nPortIdx = nSw/8;
	nBitIdx = nSw%8;

	//Set IO to input
	bit_set(nPortConfig[nPortIdx], nBitIdx);

	i2c_start(local_master);
	i2c_write(local_master, PCA9535_ADDRESS);
	i2c_write(local_master, 0x06+nPortIdx); //Configure port
	i2c_write(local_master, nPortConfig[nPortIdx]);
	i2c_stop(local_master);

	i2c_start(local_master);
	i2c_write(local_master, PCA9535_ADDRESS);	//Set read port
	i2c_write(local_master, nPortIdx); //Port address
	i2c_start(local_master);
	i2c_write(local_master, PCA9535_ADDRESS | 0x01);	//Read input port
	nData = i2c_read(local_master);
	i2c_stop(local_master);
	
	return bit_test(nData, nBitIdx);

}

//Read all (16) switches
int16 ReadPCA9535All()
{
	int16 nData = 0;
	int nTempL, nTempH=0;

	//Set IO to input
	bit_set(nPortConfig[0], 0xFF);
	bit_set(nPortConfig[1], 0xFF);

	i2c_start(local_master);
	i2c_write(local_master, PCA9535_ADDRESS);
	i2c_write(local_master, 0x06); //Configure port
	i2c_write(local_master, nPortConfig[0]);
	i2c_write(local_master, nPortConfig[1]);
	i2c_stop(local_master);

	i2c_start(local_master);
	i2c_write(local_master, PCA9535_ADDRESS);	//Set read port
	i2c_write(local_master, 0); //Port address
	i2c_start(local_master);
	i2c_write(local_master, PCA9535_ADDRESS | 0x01);	//Read input port
	nTempL = i2c_read(local_master);
	nTempH = i2c_read(local_master);
	i2c_stop(local_master);
	
	nData = nTempH;
	nData <<= 8;
	nData |= nTempL;
	return nData;

}

//Send command to Quantum Naviscroll chip
void NaviscrollCommand(int nCmd)
{
	int nPortIdx;
	nPortIdx = 1;
	
	nPortConfig[nPortIdx] &= 0x3;	//SW10~SW15 are reserved for Naviscroll
	nPortState[nPortIdx]&= 0x3;
	nPortState[nPortIdx] |= (nCmd<<2)&0xFC;
	
	
	if(g_bDebug)
	{
		printf(usb_cdc_putc, "NVS: nPortState[%d]=0x%02X\r\n", nPortIdx, nPortState[nPortIdx]);	
		printf(usb_cdc_putc, "NVS: nPortConfig[%d]=0x%02X\r\n", nPortIdx, nPortConfig[nPortIdx]);	
	}


	//Set SW10~SW15 to output
	i2c_start(local_master);
	i2c_write(local_master, PCA9535_ADDRESS);
	i2c_write(local_master, 0x06+nPortIdx); //Configure port
	i2c_write(local_master, nPortConfig[nPortIdx]);
	i2c_stop(local_master);


	//Send command, with Strobe line low
	bit_clear(nPortState[nPortIdx], 7); //SW15 is strobe line
	i2c_start(local_master);
	i2c_write(local_master, PCA9535_ADDRESS);
	i2c_write(local_master, 0x02 + nPortIdx); //Configure port
	i2c_write(local_master, nPortState[nPortIdx]);
	i2c_stop(local_master);
	
	//delay_us(50);
	delay_ms(NAVISCROLL_CLOCK);
	
	//Send command, with Strobe line high
	bit_set(nPortState[nPortIdx], 7); //SW15 is strobe line
	i2c_start(local_master);
	i2c_write(local_master, PCA9535_ADDRESS);
	i2c_write(local_master, 0x02 + nPortIdx); //Configure port
	i2c_write(local_master,nPortState[nPortIdx]);
	i2c_stop(local_master);
	
	//delay_us(200);	//Stay high 200 + 100us (I2C command)
	delay_ms(NAVISCROLL_CLOCK);
	
	//Send command, with Strobe line low
	bit_clear(nPortState[nPortIdx], 7); //SW15 is strobe line
	i2c_start(local_master);
	i2c_write(local_master,PCA9535_ADDRESS);
	i2c_write(local_master, 0x02 + nPortIdx); //Configure port
	i2c_write(local_master, nPortState[nPortIdx]);
	i2c_stop(local_master);
	
	//delay_us(50);
	delay_ms(NAVISCROLL_CLOCK);

	//Set SW10~SW15 back to input (low)
	nPortConfig[nPortIdx] |= 0xFC;
	i2c_start(local_master);
	i2c_write(local_master, PCA9535_ADDRESS);
	i2c_write(local_master, 0x06+nPortIdx); //Configure port
	i2c_write(local_master, nPortConfig[nPortIdx]);
	i2c_stop(local_master);
	
}

void ResetPCA9535()
{

	nPortConfig[0] = 0xFF;
	nPortConfig[1] = 0xFF;
	nPortState[0] = 0xFF;
	nPortState[1] = 0xFF;

	i2c_start(local_master);
	i2c_write(local_master, PCA9535_ADDRESS);
	i2c_write(local_master, 0x06); //Configure port
	i2c_write(local_master, 0xFF);
	i2c_write(local_master, 0xFF);
	i2c_stop(local_master);
}

int SetSwitch(char *sSwitch, int bOn)
{
	int nTmp = 0;
	int nRow, nCol, nSwitch;
	if(sSwitch[nTmp] == 'R')	//Format SWO RNCN, e.g. SWO R0C11
	{
		nTmp++;
		nRow = sSwitch[nTmp] - '0';	// Max 8 rows
		nTmp += 2;
		nCol = sSwitch[nTmp] - '0';	//Max 12 cols
		nTmp++;
		if(sSwitch[nTmp] >= '0' && sSwitch[nTmp] <= '9')
		{
			nCol *= 10;
			nCol += sSwitch[nTmp] - '0';
		}
		if(bOn)
			WriteADG2128(nCol, nRow, 1);
		else
			WriteADG2128(nCol, nRow, 0);
		
	}
	else if(sSwitch[nTmp] == 'S')	//Format SWO SWN, N=[0..15], e.g. SWO SW3
	{
		nTmp += 2;
		nSwitch = atoi(sSwitch + nTmp );
		if(bOn)
			WritePCA9535(nSwitch, 0);	//On - connect to GND
		else
			WritePCA9535(nSwitch, 2);	//Off - set to input state
	}
	else if(sSwitch[nTmp] == 'P')	//Format SWO PWR, turn off DUT power
	{
		if(bOn)
			output_high(PIN_DUT_PWR);
		else
			output_low(PIN_DUT_PWR);
	}
	else
	{
		if(g_bDebug)
			printf(usb_cdc_putc, "ERR: Wrong SWO Format: SWO RXCY|SWN|PWR");
			
		return 0;
	}
	return 1;
}

int PWMSwitch(char *sSwitch, int16 nRepeat, int16 nOnTime, int16 nOffTime)
{
	int16 i, nOnCount, nOffCount;
	if(g_bDebug)
		printf(usb_cdc_putc, "PWMSwitchS: nRepeat=%ld, nOnTime=%ld, nOffTime=%ld\r\n", nRepeat, nOnTime, nOffTime);

	for(i=0; i<nRepeat; i++)
	{
		nOnCount = nOnTime;
		nOffCount = nOffTime;
		SetSwitch(sSwitch, 1);
		LED_ON;
		while(nOnCount > 255)
		{
			delay_ms(255);
			nOnCount -= 255;
		}
		delay_ms(nOnCount);
		SetSwitch(sSwitch, 0);
		LED_OFF;
		if(i < nRepeat - 1)
		{
			while(nOffCount > 255)
			{
				delay_ms(255);
				nOffCount -= 255;
			}
			delay_ms(nOffCount);
		}
	}
	
	LED_ON;
	return 1;
}

//sParam format: SWX,2,80,300
int PWMSwitchS(char *sParam)
{
	char *sSwitch, *sRepeat, *sOnTime, *sOffTime;
	int16 nRepeat=1, nOnTime = 80, nOffTime = 300;
	sSwitch = sParam;
	sRepeat = strchr(sSwitch, ',');
	if(sRepeat)
	{
		*sRepeat = 0;
		sRepeat ++;
		sOnTime = strchr(sRepeat, ',');
		if(sOnTime)
		{
			*sOnTime = 0;
			sOnTime++;
			sOffTime = strchr(sOnTime, ',');
			if(sOffTime)
			{
				*sOffTime = 0;
				sOffTime++;
				nOffTime = atol(sOffTime);
			}
			nOnTime = atol(sOnTime);
		}
		nRepeat = atol(sRepeat);
		
	}		
	
	return PWMSwitch(sSwitch, nRepeat, nOnTime, nOffTime);
}

//Set accelerometer OUTX, OUTY, OUTZ
//sParam formats: 
//Format 1: ACC X,Y,Z , e.g. "ACC 0,0,64", set X=0, Y=0, Z=64
//Format 2: ACC REGXX=DD, e.g. "ACC REG41=0", Set register 0x29=0, i.e X=0 for LIS302DL
//Format 3: ACC REGXX?, e.g. "ACC REG15?", query value of register 0x0F. Returns "Ok 59", i.e WHOAMI is 0x3B
//Format 4: ACC INTX=SWXX, e.g. "ACC INT1=SW6", set SW6 as INT1 
//Format 5: ACC DBG
//Returns:
//-1 : Error with response
//0: Ok no response
//>1: Ok with response
int ACC(char *sParam)
{
	char *sOutX, *sOutY, *sOutZ, *sTemp;
	byte nOutX=0, nOutY=0, nOutZ = 64;
	byte nRegAddr, nRegVal, i;
	if(sParam[0] == 'R' && sParam[1] == 'E' && sParam[2] == 'G')	//REG Register read/write command
	{
		i = 3;
		while(sParam[i] >=0 && sParam[i] <= '9')	//Get register address
		{
			i++;
		}
		if(i == 3 || i > 5)	//Invalide register address
		{
			printf(usb_cdc_putc, "ERR:Invalide Register Address %s\r\n", sParam);
			return -1;
		}
		if(sParam[i] == '=')	//Set register command
		{
			sParam[i] = 0;
			nRegAddr = atoi(sParam+3);
			nRegVal = atoi(sParam+i+1);
			
			if(nRegAddr >= 0x40)
			{
					printf(usb_cdc_putc, "ERR:Invalide Register Address 0x%X\r\n", nRegAddr);
					return -1;
			}
			ACC_REG[nRegAddr] = nRegVal;
			return 0;
			
		}
		else if(sParam[i] == '?')	//Query command
		{
			sParam[i] = 0;
			nRegAddr = atoi(sParam+3);
			
			if(nRegAddr >= 0x40)
			{
					printf(usb_cdc_putc, "ERR:Invalide Register Address 0x%X\r\n", nRegAddr);
					return -1;
			}
			printf(usb_cdc_putc, "Ok %d\r\n", ACC_REG[nRegAddr]);
				
			return 1;
		}
		else
		{
			printf(usb_cdc_putc, "ERR:Incorrect format %s\r\n", sParam);
			return -1;
			
		}
	}
	else if(sParam[0] == 'I' && sParam[1] == 'N' && sParam[2] == 'T' )	//INTX=SWN set int line or INTX? to query current int line
	{
		if(sParam[3] == '1')	//INT1
		{
			if(sParam[4] == '?')
			{
				printf(usb_cdc_putc, "Ok %s\r\n", sACCINT1Port);
				
				return 1;
			
			}
			else
			{
				 i=0;
			 	while(sParam[5+i] > 0x20 && i< 5)
				{
					sACCINT1Port[i] = sParam[5+i];
					i++;
					sACCINT1Port[i] = 0;
				}
			}
			
			return 0;
		}
		else if(sParam[3] == '2')	//INT2
		{
			if(sParam[4] == '?')
			{
				printf(usb_cdc_putc, "Ok %s\r\n", sACCINT1Port);
				
				return 1;
			
			}
			else
			{
				 i=0;
				 while(sParam[5+i] > 0x20 && i< 5)
				{
					sACCINT2Port[i] = sParam[5+i];
					i++;
					sACCINT2Port[i] = 0;
				}
		}
			
			return 0;
		}
	}
	else if(sParam[0] == 'T' && sParam[1] == 'Y' && sParam[2] == 'P' && sParam[3] == 'E')	//TYPE=N set accelerometer chip type
	{
		if(sParam[5] == '1')
		{
			g_nACCType = 1;	//ADXL340
			ACC_REG = ADXL340_REG;
		}
		else
		{
			g_nACCType = 0;	//LIS302DL
			ACC_REG = LIS302DL_REG;
		}
		return 0;
	}
	else if(sParam[0] == 'E' && sParam[1] == 'N' )	//EN=1 or EN=0 Enable/Disable Accelerometer
	{
		if(sParam[2] == '?')	//Query enable status
		{
			printf(usb_cdc_putc, "Ok %d\r\n", g_bACCEn);			
			return 1;
		}
		else if(sParam[2] == '=')	//Set enable status
		{
			 if(sParam[3] == '1')
			 {
			 		CKP=1;		//Release clock
			 		SSPM3=0;SSPM2=1;SSPM1=1;SSPM0=0;	//I2C slave mode, 7 bit address
			 		GCEN=0;	//Disable general call
			 		SEN=0;	//Disable clock stretching
			 		i=get_tris_b();
			 		set_tris_b(i|0x3);	//port B0/B1 as input
			 		SSPEN=1;	//enable MSSP module
			 		g_bACCEn = 1;
			 }
			 else
			 {
			 		i=get_tris_b();
			 		set_tris_b(i|0x3);	//port B0/B1 as input
					SSPEN=0;	//disable MSSP module
			 		g_bACCEn = 0;
			 }
		}
		 		
		 	return 0;
	}
	else if(sParam[0] == 'D' && sParam[1] == 'B' && sParam[2] == 'G')
	{
		///////////////////Accelerometer debug
		if(bI2C_read)
			{
				printf(usb_cdc_putc, "I2C: Read Reg 0x%02X(0x%02X)\r\n", nI2C_readAddr, nI2C_readData);
				bI2C_read = 0;
			}
			else
				{
					printf(usb_cdc_putc, "I2C: No read op\r\n");
				}
		if(bI2C_write)
			{
				printf(usb_cdc_putc, "I2C: Write Reg 0x%02X(0x%02X)\r\n", nI2C_writeAddr, nI2C_writeData);
				bI2C_write = 0;
			}
			else
				{
					printf(usb_cdc_putc, "I2C: No write op\r\n");
				}
		delay_ms(50);
		printf(usb_cdc_putc, "I2C: CTRLREG[1:3]=0x%02X,0x%02X,0x%02X\r\n", 
			LIS302DL_REG[LIS302DL_CTRL1],
			LIS302DL_REG[LIS302DL_CTRL2],
			LIS302DL_REG[LIS302DL_CTRL3]);
			
				
				return 0;
	}
	else if(sParam[0] >= 0 && sParam[0] <= '9')	//Set X,Y,Z command
	{
		sOutX = sParam;
		sOutY = strchr(sOutX, ',');
		if(sOutY)
		{
			*sOutY = 0;
			sOutY ++;
			sOutZ = strchr(sOutY, ',');
			if(sOutZ)
			{
				*sOutZ = 0;
				sOutZ++;

				nOutZ = atoi(sOutZ);
			}
			nOutY = atoi(sOutY);
		
		}		

		nOutX = atoi(sOutX);
		
//		if(g_nACCType == 0) //LIS302DL
		{
			LIS302DL_REG[LIS302DL_OUTX] = nOutX;
			LIS302DL_REG[LIS302DL_OUTY] = nOutY;
			LIS302DL_REG[LIS302DL_OUTZ] = nOutZ;
		}
//		else	//ADXL340
		{
			ADXL340_REG[ADXL340_DATAX] = nOutX;
			ADXL340_REG[ADXL340_DATAY] = nOutY;
			ADXL340_REG[ADXL340_DATAZ] = nOutZ;
		}
	}
	else
	{
			printf(usb_cdc_putc, "ERR:Incorrect format %s\r\n", sParam);
			return -1;
	}
		
	return 0;
}

void LoadConfig()
{
	int i;
	char *pby = (char *)&Config;
	delay_ms(100);
	for(i=0; i<sizeof(Config); i++)
	{
		*pby = read_eeprom(ADDRESS_CONFIG+i);
		delay_ms(1);
		pby++;
	}
}

void SaveConfig()
{
	int i;
	char *pby = (char *)&Config;
	delay_ms(100);
	for(i=0; i<sizeof(Config); i++)
	{
		write_eeprom(ADDRESS_CONFIG+i, *pby);
		delay_ms(1);
		pby++;
	}
}

int OutputPin(int nLevel, char *sPort)
{
	int nIOPin;
	nIOPin = atol(sPort + 2);
	if(sPort[0] == 'R') //Native port
	{
		//printf(usb_cdc_putc, "IOH/L:%s - %d, %d\r\n", sPort, nIOPin, nLevel);	
		if(sPort[1] == 'B')
		{
			switch(nIOPin)
			{
			//case 0: output_bit(PIN_B0, nLevel);break;	//SDA - SLAVE
			//case 1: output_bit(PIN_B1, nLevel);break;	//SCL - SLAVE
			//case 2: output_bit(PIN_B2, nLevel);break;	//IO_INT
			//case 3: output_bit(PIN_B3, nLevel);break;	//RST
			//case 4: output_bit(PIN_B4, nLevel);break;	//SDA - MASTER
			//case 5: output_bit(PIN_B5, nLevel);break;	//SCL - MASTER
			case 6: output_bit(PIN_B6, nLevel);break;
			case 7: output_bit(PIN_B7, nLevel);break;
			default: return 0;
			}
		}
		else if(sPort[1] == 'C')
		{
			switch(nIOPin)
			{
			case 0: output_bit(PIN_C0, nLevel);break;
			case 1: output_bit(PIN_C1, nLevel);break;
			//case 2: output_bit(PIN_C2, nLevel);break;	//Used by LED
			//case 3: output_bit(PIN_C3, nLevel);break;	//RC3 doesn't exist
			//case 4: output_bit(PIN_C4, nLevel);break;	//USB D-
			//case 5: output_bit(PIN_C5, nLevel);break;	//USB D+
			case 6: output_bit(PIN_C6, nLevel);break;
			case 7: output_bit(PIN_C7, nLevel);break;
			default: return 0;
			}
		}
		else if(sPort[1] == 'D')
		{
			switch(nIOPin)
			{
			case 0: output_bit(PIN_D0, nLevel);break;
			case 1: output_bit(PIN_D1, nLevel);break;
			case 2: output_bit(PIN_D2, nLevel);break;
			case 3: output_bit(PIN_D3, nLevel);break;
			case 4: output_bit(PIN_D4, nLevel);break;
			case 5: output_bit(PIN_D5, nLevel);break;
			case 6: output_bit(PIN_D6, nLevel);break;
			case 7: output_bit(PIN_D7, nLevel);break;
			default: return 0;
			}
		}
	}
	else if(sPort[0] == 'S' && sPort[1] == 'W') //Switch
	{
		if(nIOPin > 15)
			return 0;
		WritePCA9535(nIOPin, nLevel);

	}
	
	return 1;
}

int16 InputPin(char *sPort)
{
	int nIOPin;
	nIOPin = atol(sPort + 2);
	if(sPort[0] == 'R') //Native port
	{
		if(sPort[1] == 'B')
		{
			switch(nIOPin)
			{
			case 0: return input(PIN_B0);break;
			case 1: return input(PIN_B1);break;
			case 2: return input(PIN_B2);break;
			case 3: return input(PIN_B3);break;
			case 4: return input(PIN_B4);break;
			case 5: return input(PIN_B5);break;
			case 6: return input(PIN_B6);break;
			case 7: return input(PIN_B7);break;
			default: return 2;
			}
		}
		else if(sPort[1] == 'C')
		{
			switch(nIOPin)
			{
			case 0: return input(PIN_C0);break;
			case 1: return input(PIN_C1);break;
			case 2: return input(PIN_C2);break;
			//case 3: return input(PIN_C3);break;
			case 4: return input(PIN_C4);break;
			case 5: return input(PIN_C5);break;
			case 6: return input(PIN_C6);break;
			case 7: return input(PIN_C7);break;
			default: return 2;
			}
		}
		else if(sPort[1] == 'D')
		{
			switch(nIOPin)
			{
			case 0: return input(PIN_D0);break;
			case 1: return input(PIN_D1);break;
			case 2: return input(PIN_D2);break;
			case 3: return input(PIN_D3);break;
			case 4: return input(PIN_D4);break;
			case 5: return input(PIN_D5);break;
			case 6: return input(PIN_D6);break;
			case 7: return input(PIN_D7);break;
			default: return 2;
			}
		}
	}
	else if(sPort[0] == 'S' && sPort[1] == 'W') //Switch
	{
		if(sPort[2] == '*')	//query all switches
		{
			return ReadPCA9535All();
		}
		else if(nIOPin > 15)
			return 2;
		else
			return ReadPCA9535(nIOPin);
	}
	else
	{
	}

	return 2;	
}

int16 ReadADC(char *sPort)
{
	int nIOPin;
	nIOPin = atol(sPort + 2);
	if(sPort[0] == 'R') //Native port
	{
		if(sPort[1] == 'A')
		{
			switch(nIOPin)
			{
			case 0: set_adc_channel(0); break;
			case 1: set_adc_channel(1); break;
			case 2: set_adc_channel(2); break;
			case 3: set_adc_channel(3); break;
			case 4: set_adc_channel(4); break;
			default: return 0;
			}
			return read_adc();
		}
		else if(sPort[1] == 'E')
		{
			switch(nIOPin)
			{
			case 0: set_adc_channel(5);break;
			case 1: set_adc_channel(6);break;
			case 2: set_adc_channel(7);break;
			default: return 0;
			}
			return read_adc();
		}
	}
	
	return 0;
}
void USBGetChar()
{
	int nChar;
	nChar = usb_cdc_getc();
	if(nChar == END_OF_CMD)	//end of command
	{
		if(nCmdLen < 3)
		{
			nCmdLen = 0;
			return;
		};
		sCommand[nCmdLen] = 0;
		bCommandReady = TRUE;
	}
	else	//Store command char
	{
		if(nChar >= 0x0D && nCmdLen < MAX_CMD_LEN)
			sCommand[nCmdLen++] = nChar;
	}

}

int GetCommandCode()
{
	int i, n, bFound;

	for(i=0; i<CMD_NUM; i++)
	{
		bFound = TRUE;
		for(n=0; n<nCmdLen && n< CMD_FIX_LEN; n++)
		{
			if(toupper(sCommand[n]) != sCmdStrings[i][n])
			{
				bFound = FALSE;
				break;
			}
		}
		if(bFound)
			return i;
	}

	return 0xFF;
}


void ParseCommand()
{
	int nCmdCode;

	int16 nTmp;
	int16 nTmp2;

	nCmdCode = GetCommandCode();
	if(nCmdCode == CMD_RST)
	{
		ResetADG2128();
		ResetPCA9535();

		printf(usb_cdc_putc, "Ok\r\n");
	}
	else if(nCmdCode == CMD_VER)	//get version
	{
		printf(usb_cdc_putc, "%s\r\n", sVersion);
	}
	else if(nCmdCode == CMD_PGM)	//Enter program (sw update) mode
	{
		write_eeprom(BOOTLOADER_CFG_ADDR, 1);
		printf(usb_cdc_putc, "Ok\r\n");	
		reset_cpu();
	}
	else if(nCmdCode == CMD_SWO)	//Switch open
	{
		SetSwitch(sCommand+CMD_FIX_LEN+1, 0);
		printf(usb_cdc_putc, "Ok\r\n");	
	}
	else if(nCmdCode == CMD_SWC)	//Switch close
	{
		SetSwitch(sCommand+CMD_FIX_LEN+1, 1);
		printf(usb_cdc_putc, "Ok\r\n");	
	}
	else if(nCmdCode == CMD_SWP)	//PWM Switch
	{
		PWMSwitchS(sCommand+CMD_FIX_LEN+1);
		printf(usb_cdc_putc, "Ok\r\n");	
		
	}
	else if(nCmdCode == CMD_NVS)	//Naviscroll
	{
		nTmp = atoi(sCommand+CMD_FIX_LEN+1);
		NaviscrollCommand(nTmp);
		if(g_bDebug)
			printf(usb_cdc_putc, "OK %ld\r\n", nTmp);
		else
			printf(usb_cdc_putc, "OK\r\n");
	}
	else if(nCmdCode == CMD_IOH)	//Set IO port high
	{
		if(OutputPin(1, sCommand+CMD_FIX_LEN+1))
		{
			printf(usb_cdc_putc, "Ok IOH\r\n");
		}
		else
		{
			printf(usb_cdc_putc, "ERR: Incorrect IOH command.\r\n");
		}
	}
	else if(nCmdCode == CMD_IOL)
	{
		if(OutputPin(0, sCommand+CMD_FIX_LEN+1))
		{
			printf(usb_cdc_putc, "Ok IOL\r\n");
		}
		else
		{
			printf(usb_cdc_putc, "ERR: Incorrect IOH command.\r\n");
		}
	}
	else if(nCmdCode == CMD_INP)	//Inpurt pin
	{
		nTmp = InputPin(sCommand+CMD_FIX_LEN+1);
		if(nTmp == 0)
			printf(usb_cdc_putc, "0\r\n");
		else if(nTmp == 1)
			printf(usb_cdc_putc, "1\r\n");
		else
		{
//			printf(usb_cdc_putc, "ERR:%s=%ld\r\n", sCommand, nTmp);
			printf(usb_cdc_putc, "0x%04lX\r\n", nTmp);
	}
	}
	else if(nCmdCode == CMD_ADC)
	{
		nTmp = ReadADC(sCommand+CMD_FIX_LEN+1);
		printf(usb_cdc_putc, "%ld\r\n", nTmp);
	}
	else if(nCmdCode == CMD_DBG)
	{
		if(sCommand[CMD_FIX_LEN+1] == 'O' && sCommand[CMD_FIX_LEN+2] == 'N')
		{
			g_bDebug = 1;
			printf(usb_cdc_putc, "Debug On\r\n");	
		}
		else
		{
			g_bDebug = 0;
			printf(usb_cdc_putc, "Debug Off\r\n");	
			
		}
		
		printf(usb_cdc_putc, "Ok\r\n");
	}
	else if(nCmdCode == CMD_ACC)
	{
		
		if(sCommand[CMD_FIX_LEN+1] == '?')
		{
			printf(usb_cdc_putc, "Ok %X,%X,%X,%X,%X,%X\r\nADDR=0x%X\r\nReadcount=%ld\r\n", 
			LIS302DL_REG[LIS302DL_CTRL1], LIS302DL_REG[LIS302DL_CTRL2], LIS302DL_REG[LIS302DL_CTRL3], 
			LIS302DL_REG[LIS302DL_OUTX], LIS302DL_REG[LIS302DL_OUTY], LIS302DL_REG[LIS302DL_OUTZ],
			i2c_regaddr, i2c_readcount);	
				
		}
		else
		{
			if(ACC(sCommand+CMD_FIX_LEN+1) == 0)
				printf(usb_cdc_putc, "Ok\r\n");	
		}
	
	}
	else if(nCmdLen > 0)
	{
		sCommand[nCmdLen] = 0;
		printf(usb_cdc_putc, "ERR:Unknown %s\r\n", sCommand);
	}

	//Clear command buffer
	nCmdLen = 0;

}

#BYTE CCP1CON=0xFBD
#BYTE UCFG=0xF6F
#BIT UPUEN=UCFG.4
#BIT FSEN=UCFG.2

void main() 
{

	int i, swStateOld, swStateNew, swChanged;

	//PCA9535 initiate
	nPortConfig[0] = 0xFF;
	nPortConfig[1] = 0xFF;
	nPortState[0] = 0xFF;
	nPortState[1] = 0xFF;

	BootloaderActive = FALSE; 

	nCmdLen = 0;


	UPUEN = 1;
	FSEN = 1;
	
	//Accelerometer variables
	SSPEN = 0;		//default disable MSSP I2C module
	g_bACCEn = 0;	//Default disabled
	g_nACCType = 0;	//Default LIS302DL

	setup_adc_ports(AN0_TO_AN7|VSS_VDD);
	setup_adc(ADC_CLOCK_INTERNAL);
	//setup_spi(FALSE); //This line causes I2C slave stop working
	setup_wdt(WDT_OFF);
	setup_timer_0(RTCC_INTERNAL);
	setup_timer_1(T1_DISABLED);


	setup_timer_3(T3_INTERNAL|T3_DIV_BY_2);


	setup_comparator(NC_NC_NC_NC);
	setup_vref(FALSE);
	setup_low_volt_detect(FALSE);
	setup_oscillator(FALSE);

	//set_timer3(5560); 	//10ms interrupt
	set_timer3(59543); 	//1ms interrupt
	enable_interrupts(INT_TIMER3);
	enable_interrupts(INT_SSP);	//I2C slave interrupt. 
	enable_interrupts(GLOBAL);


	nLEDTimer = 200;
	LED_ON;
	delay_ms(200);


	write_eeprom(BOOTLOADER_CFG_ADDR, 0);

	usb_init();

	//init variables
	//LoadConfig();

	if(Config.nID != 0x55AA)	//Configure value never been saved to EEPROM
	{
		Config.nID = 0x55AA;
		Config.nCurOffset = 0;
		Config.nVolOffset = 40;
		Config.fVolRate = 0.320905;
		Config.fCurRate100 = 0.999005;	
		Config.fCurRate1000 = 1.002965;	
		Config.fCurRateHigh = 1.002733;	
		//Config.fTmpRate = 2.0; //2mA/C
		Config.fTmpRate = 1.0;
		//Config.fTmpBase = fTmpSample;
		Config.nTimerBase = 59543;
		//SaveConfig();
	}
	
	//Turn on DUT power
	output_high(PIN_DUT_PWR);


	i=0; 

	swStateOld = 0xFF;

	do {


		if(nLEDTimer > 0)
			LED_OFF;
		else
			LED_ON;

			
//////////////////End of accelerometer debug
	
		if(usb_cdc_kbhit())
			USBGetChar();

		if(bCommandReady)
		{
			ParseCommand();
			bCommandReady = FALSE;
			nLEDTimer = 40;
		}
		
		if(g_bACCEn)	//Accelerometer enabled
		{
			if(g_nACCType == 0)	//LIS302DL
			{
				if(LIS302DL_REG[LIS302DL_CTRL3]&0x04)	//DataReady enabled
				{
					if(nLIS302SampleTimer < 2)
						OutputPin(0, sACCINT1Port);	//Clear INT1 pin
					else
					{
						if(LIS302DL_REG[LIS302DL_CTRL3]&0x40)	//Open drain
						InputPin(sACCINT1Port);	//Floating INT1 pin
					else
						OutputPin(1, sACCINT1Port);
					}
				}
			}
			else if(g_nACCType == 1)	//ADXL340
			{
				if(ADXL340_REG[ADXL340_CTL]&0x40)	//DataReady enabled
				{
					if(nLIS302SampleTimer < 2)
						OutputPin(0, sACCINT1Port);	//Clear INT1 pin
					else
					{
						OutputPin(1, sACCINT1Port);
					}
				}
			}
		} 	
	} while (TRUE);
}