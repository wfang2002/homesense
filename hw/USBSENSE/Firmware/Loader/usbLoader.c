/*

	USBEMT USB Boot loader
	Steps:
	1. Issure USBEMT command PGM
	2. Reset USBEMT
	3. Send HEX program code to USBEMT. Wait at least 5ms from 'ok' response between each line
	4. Reset USBEMT
*/



#include <18F4550.h>
#device adc=10
#use delay(clock=48000000)  
#rom int 0xf000ff={1}

#define _BOOTLOADER
#include "..\share\bootloader.h"

#org HIGH_INT_VECTOR, INTERRUPT_REMAP_END 
void isr_relocate(void) 
{ 
#asm 
  // Address 0x0008 is the hardware High priority interrupt 
  TSTFSZ BootloaderActive       // if bootloader active 
  goto  LOADER_HIGH_INT         // then jump to bootloader ISR 
  GOTO  APPLICATION_HIGH_INT    // else jump to application ISR 
  NOP
  NOP
  NOP                           // Just filling memory 

  // Address 0x0018 is the hardware Low priority interrupt 
  TSTFSZ BootloaderActive       // if bootloader active 
  goto   LOADER_NORMAL_INT      // then jump to bootloader ISR 
  GOTO   APPLICATION_NORMAL_INT // else jump to application ISR 
#endasm 
}

//configure a 20MHz crystal to operate at 48MHz
//  #fuses HSPLL,NOWDT,NOPROTECT,NOLVP,NODEBUG,USBDIV,PLL5,CPUDIV1,VREGEN

//Configure a 4MHz crystal
#fuses HSPLL,NOWDT,NOPROTECT,NOLVP,NODEBUG,USBDIV,PLL1,CPUDIV1,VREGEN, NOBROWNOUT


// Includes all USB code and interrupts, as well as the CDC API
#include "..\share\usb_cdc.h"
#include <stdlib.h>


#define BUFFER_LEN_LOD 64
#define BUFFER_BIN_BLOCK 64

int  nBuffidx;
char gBuffer[BUFFER_LEN_LOD];
BYTE gBinBlock[BUFFER_BIN_BLOCK];
int32 gBlockAddr;
int16 gBlockWritePtr;


#define PIN_LED PIN_C2

#SEPARATE
unsigned int atoi_b16(char *s) {  // Convert two hex characters to a int8
	unsigned int result = 0;
	int i;

	for (i=0; i<2; i++,s++)  {
		if (*s >= 'A')
			result = 16*result + (*s) - 'A' + 10;
		else
			result = 16*result + (*s) - '0';
	}

	return(result);
}


#byte TBLPTRU=0xFF8
#byte TBLPTRH=0xFF7
#byte TBLPTRL=0xFF6
#byte TABLAT=0xFF5

#byte EECON1=0xFA6
#byte EECON2=0xFA7
#byte INTCON=0xFF2

#bit WR=EECON1.1
#bit WREN=EECON1.2
#bit FREE=EECON1.4
#bit CFGS=EECON1.6
#bit EEPGD=EECON1.7

void WriteFlashBlock(int32 addr, BYTE * pBuff, long nLen)
{
	int i,j;

	addr = gBlockAddr;

	//Erase flash first
	TBLPTRU = (byte)(addr>>16);
	TBLPTRH = (byte)((addr>>8)&0xFF);
	TBLPTRL = (byte)(addr&0xFF);


	EEPGD = 1;
	CFGS = 0;
	WREN = 1;
	FREE = 1;
	
	disable_interrupts(GLOBAL); 
	
	EECON2 = 0x55;
	EECON2 = 0xAA;
	
	WR = 1;	//Start erase
	
	for(i=0; i<2; i++)
	{
		for(j=0; j<32; j++)
		{
			TABLAT = *pBuff++;
#asm
			TBLWT*+
#endasm		
		}

		TBLPTRU = (byte)(addr>>16);
		TBLPTRH = (byte)((addr>>8)&0xFF);
		TBLPTRL = (byte)(addr&0xFF);
		addr += 32;

		disable_interrupts(GLOBAL);
		
		EEPGD = 1;
		CFGS = 0;
		WREN = 1;
		
		EECON2 = 0x55;
		EECON2 = 0xAA;
		
		WR = 1;	//Start program
		
		enable_interrupts(GLOBAL);
		WREN = 0;
	}
	
	
	enable_interrupts(GLOBAL);
	
}


//#ORG LOADER_ADDR+10 //LOADER_END auto=0 default
void real_load_program (void)
{
	int8  checksum, line_type;
	int16 l_addr,h_addr=0;
	int32 addr;
	int ch;
	int bDone = FALSE;
	int8  i, count;
	
	gBlockAddr = LOADER_END + 1;

	while (!bDone)  // Loop until the entire program is downloaded
	{
		nBuffidx = 0;  // Read into the buffer until 0x0D ('\r') is received or the buffer is full
		output_low(PIN_LED);
		do 
		{

			while(!usb_cdc_kbhit());
			ch = usb_cdc_getc();

			if(ch == 0x0D || ch == 0x0A)
			{
				break;
			}
			gBuffer[nBuffidx++] = ch;

		} while ( nBuffidx <= BUFFER_LEN_LOD);

		gBuffer[nBuffIdx] = 0;

		output_high(PIN_LED);		

		// Only process data blocks that start with ':'
      		if (gBuffer[0] == ':') 
      		{
			count = atoi_b16 (&gBuffer[1]);  // Get the number of bytes from the buffer

			// Get the lower 16 bits of address
			l_addr = make16(atoi_b16(&gBuffer[3]),atoi_b16(&gBuffer[5]));

			line_type = atoi_b16 (&gBuffer[7]);

			addr = make32(h_addr,l_addr);
		}
		else
			continue;
		
	//	printf(usb_cdc_putc,"\r\n%u:%lX:%u \r\n", count, addr, line_type);
		
		if(line_type == 0x01 && count == 0)	//end of HEX file
		{
			bDone = true;
		}
		
		checksum = 0;  // Sum the bytes to find the check sum value
		for (i=1; i<(nBuffidx-2); i+=2)
               		checksum += atoi_b16 (&gBuffer[i]);
               		
        	checksum = 0xFF - checksum + 1;

            	if (checksum != atoi_b16 (&gBuffer[nBuffidx-2]))
            	{
               		printf(usb_cdc_putc, "Err %02X\r\n", checksum);
               	}
               	else
               	{
			if(line_type == 0 && h_addr < 0x02)
			{
				if(addr < gBlockAddr + BUFFER_BIN_BLOCK)	//new hex line is in the same block
				{
					//printf(usb_cdc_putc,"\r\Add to %lX \r\n", gBlockAddr);
					gBlockWritePtr = addr - gBlockAddr;
					for(i=0; i<count; i++)
					{
						gBinBlock[gBlockWritePtr++] = atoi_b16(&gBuffer[i*2+9]);
					}	

				}
				else //write block if address out of current block range
				{
					if(gBlockWritePtr > 0 && gBlockAddr > LOADER_END)	//There is something in Block
					{
					//Write block to flash
						WriteFlashBlock(gBlockAddr, gBinBlock, BUFFER_BIN_BLOCK);
					}
			
					memset(gBinBlock, 0xFF, BUFFER_BIN_BLOCK);
			
					gBlockAddr = addr&0xFFFFFFC0; //Align to 64byte block boundary
					gBlockWritePtr = addr - gBlockAddr;
				
					//printf(usb_cdc_putc,"\r\Add to %lX \r\n", gBlockAddr);
					for(i=0; i<count; i++)
					{
						gBinBlock[gBlockWritePtr++] = atoi_b16(&gBuffer[i*2+9]);
					}
				}
			}
			else if (line_type == 4)
				h_addr = make16(atoi_b16(&gBuffer[9]), atoi_b16(&gBuffer[11]));

		
			//write block if end of hex file
			if(bDone )
			{
				if(gBlockWritePtr > 0 && gBlockAddr > LOADER_END)	//There is something in Block
				{
					//Write block to flash
					WriteFlashBlock(gBlockAddr, gBinBlock, BUFFER_BIN_BLOCK);
				}			
			}

			printf(usb_cdc_putc, "Ok\r\n");
		}

	}
}

void main() 
{

	BootloaderActive = TRUE; 

	output_low(PIN_LED);
	delay_ms(200);


	//Goes to loader mode if flag set or PIN_UPD is low
	if(read_eeprom(BOOTLOADER_CFG_ADDR) != 0 )
	{

		usb_init();

		//Waiting for port connected
		while(!usb_cdc_connected()) 
		{
			delay_ms(50);
			output_low(PIN_LED);
			delay_ms(50);
			output_high(PIN_LED);
		};

		printf(usb_cdc_putc,"BTUSB Bootloader V1.0\r\n");

		real_load_program();

		write_eeprom(BOOTLOADER_CFG_ADDR, 0);

		//printf(usb_cdc_putc,"USBKB Programming ended.\r\n");

		delay_ms(2000);
		reset_cpu();
	}

	goto_address(APPLICATION_START);

}


