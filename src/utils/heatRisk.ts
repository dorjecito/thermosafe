export interface HeatRisk {
      level: 'Cap risc' | 'Baix' | 'Moderat' | 'Alt' | 'Extrem';
      color: string;
      class: 'safe' | 'mild' | 'moderate' | 'high' | 'ext';
      isHigh: boolean;
      isExtreme: boolean;
    }
    
    /**
     * Converteix l’índex de calor (ST) en nivell de risc segons la taula INSST.
     */
    
    export function getHeatRisk(st: number): HeatRisk {
        if (st < 27)
          return {
            level: 'Cap risc',
            color: 'gray',
            class: 'safe',
            isHigh: false,
            isExtreme: false,
          };
      
        if (st < 32)
          return {
            level: 'Baix',
            color: 'green',
            class: 'mild',
            isHigh: false,
            isExtreme: false,
          };
      
        if (st < 41)
          return {
            level: 'Moderat',
            color: 'goldenrod',
            class: 'moderate',
            isHigh: false,
            isExtreme: false,
          };
      
        if (st < 54)   
          return {
            level: 'Alt',
            color: 'orange',
            class: 'high',
            isHigh: true,
            isExtreme: false,
          };
      
        return {
          level: 'Extrem',
          color: 'red',
          class: 'ext',
          isHigh: true,
          isExtreme: true,
        };
      }
    