 /**
 * 'hailerTheme' is overwriting and in some cases extending the Chakra UI default theme.
 * Most components match Hailer brand design out of the box.
 * Note: In addition to Hailer styles, some components include variants/styles that don't match Hailer brand design.
 */

import { extendTheme } from "@chakra-ui/react";
import type { StyleFunctionProps } from '@chakra-ui/styled-system';
import { cssVar } from "@chakra-ui/theme-tools";
import { customColors } from "./customColors";

const $bg = cssVar("tooltip-bg")
const $fg = cssVar("tooltip-fg")
const $arrowBg = cssVar("popper-arrow-bg")
const $arrowShadowColor = cssVar("popper-arrow-shadow-color")

const hailerTheme = extendTheme({
    config: {
        initialColorMode: undefined,
        useSystemColorMode: true,
    },
    fonts: {
        body: "Nunito Sans, sans-serif, emoji",
        heading: "Nunito Sans, sans-serif, emoji",
    },
    colors: {
        gray: {
            50: '#f9fafd',
            100: '#f3f4f7',
            200: '#e9ebee',
            300: '#c7cad1',
            400: '#999ca4',
            500: '#53565F',
            600: '#34373f',
            700: '#292c33',
            800: '#202124',
            900: '#151618',
        },
        green: {
            50: '#f0fff4',
            100: '#B7E8C6',
            200: '#7DD197',
            300: '#36ba5f',
            400: '#20a250',
            500: '#17873f',
            600: '#006c32',
            700: '#01592a',
            800: '#003217',
            900: '#001d0d'
        },
        red: {
            50: '#fef0f0',
            100: '#f6dfdf',
            200: '#edbebe',
            300: '#e49c9c',
            400: '#f15353',
            500: '#e42b00',
            600: '#cc1318',
            700: '#9a1d00',
            800: '#611a0a',
            900: '#3e1309'
        },
        blue: {
            50: '#ebeef6',
            100: '#d9e8f7',
            200: '#a2b9d6',
            300: '#6a8ab4',
            400: '#4c71a0',
            500: '#2e4d71',
            600: '#253c56',
            700: '#172a3f',
            800: '#081826',
            900: '#071623'
        },
        orange: {
            50: '#fffff0',
            100: '#fffadf',
            200: '#fee39c',
            300: '#ffc224',
            400: '#e7a224',
            500: '#ce8223',
            600: '#a16425',
            700: '#775728',
            800: '#62512A',
            900: '#4c4a2b',
        },
       customColors,
    },
    semanticTokens: {
        colors: {
            'chakra-placeholder-color': {_light: 'gray.400', _dark: 'gray.400'},
            'chakra-subtle-text': {_light: 'gray.500', _dark: 'gray.400'},
            subtleText: {_light: 'gray.500', _dark: 'gray.400'},
            'chakra-body-text': {_light: 'gray.800', _dark: 'customColors.darkModeBodyText'},
            bodyText: {_light: 'gray.800', _dark: 'customColors.darkModeBodyText'},
            'chakra-body-bg': {_light: 'gray.100', _dark: 'gray.800'},
        }
    },
    /**
     * Alert border-radiuses here because otherwise Toast that is built from Alert did not get the correct border-radius. Other Alert styles are in the component styles.  
     */
    styles: {
        global: {
            html: {
                'WebkitFontSmoothing': 'unset'
            },
          '.chakra-alert': {
            '&[data-status="success"]': {
                borderRadius: '4px',
            },
            '&[data-status="error"]': {
                borderRadius: '4px',
            },
            '&[data-status="warning"]': {
                borderRadius: '4px',
            },
            '&[data-status="info"]': {
                borderRadius: '4px',
            },
            '&[data-status="loading"]': {
                borderRadius: '4px',
            },
          },
        },
      },
    shadows: {
        outline: '0 0 0 3px var(--chakra-colors-customColors-baseBlue)'
    },
    /**
     * sm = 2px; base = 4px; md = 8px; lg = 10px; xl = 15px; 2xl = 20px; 3xl = 25px
     */
    radii: {
        "none": '0',
        "sm": '0.125rem',
        "base": '0.25rem',
        "md": '0.5rem',
        "lg": '0.625rem',
        "xl": '0.938rem',
        "2xl": '1.25rem',
        "3xl": '1.563rem',
        "full": '9999px'
    },
    components: {
        Link: {
            baseStyle: {
                _light: {
                    color: 'customColors.baseBlue'
                },
                _dark: {
                    color: 'customColors.baseBlueLight'
                }
            }
        },
        Button: {
            baseStyle: {
                fontWeight: 'bold',
                textTransform: 'uppercase',
                borderRadius: '30px',
                letterSpacing: 'wider',
                lineHeight: 1,
                _disabled: {
                    opacity: 0.3,
                },
                _light: {
                    _focusVisible: {
                        boxShadow: "none",
                        outline: '2px solid var(--chakra-colors-customColors-baseBlue)'
                      },
                },
                _dark: {
                    _focusVisible: {
                        boxShadow: "none",
                        outline: '2px solid var(--chakra-colors-customColors-baseBlueLight)'
                      },
                },
            },
            sizes: {
                xs: {
                  fontSize: 'xs',
                  svg: {
                    height: '1rem',
                    width: '1rem',
                }
                },
                sm: {
                  fontSize: 'xs',
                  py: 0.5,
                  px: 4,
                  svg: {
                    height: '1.375rem',
                    width: '1.375rem',
                    marginLeft: '-3px',
                    marginRight: '-3px',
                }
                },
                md: {
                  fontSize: 'xs',
                  py: 3,
                  px: 4,
                  svg: {
                    height: '1.5rem',
                    width: '1.5rem',
                    marginLeft: '-3px',
                    marginRight: '-3px',
                }
                },
                lg: {
                  fontSize: 'xs',
                  height: '2.75rem',
                  minWidth: '2.75rem',
                  py: 3.5,
                  svg: {
                    height: '1.5rem',
                    width: '1.5rem',
                }
                },
            },
            variants: {
                solid: (props: StyleFunctionProps ) => ({
                    _light: {
                        color: props.colorScheme === 'gray' ? 'blue.600' : undefined,
                        bg: props.colorScheme === 'green' ? 'green.500' :
                            props.colorScheme === 'red' ? 'red.500' :
                            props.colorScheme === 'blue' ? 'blue.600' : undefined,
                        _hover: { 
                            bg: props.colorScheme === 'green' ? 'green.600' :
                                props.colorScheme === 'red' ? 'red.600' :
                                props.colorScheme === 'blue' ? 'blue.700' : undefined,
                        },
                        _active: { 
                            bg: props.colorScheme === 'green' ? 'green.700' :
                                props.colorScheme === 'red' ? 'red.700' :
                                props.colorScheme === 'blue' ? 'blue.800' : undefined,
                        }
                    },
                    _dark: {
                        color:
                            props.colorScheme === 'green' ||
                            props.colorScheme === 'red' ||
                            props.colorScheme === 'blue' 
                            ? 'whiteAlpha.900' : undefined,
                        bg: props.colorScheme === 'green' ? 'green.500' :
                            props.colorScheme === 'red' ? 'red.500' :
                            props.colorScheme === 'blue' ? 'blue.600' : undefined,
                        _hover: { 
                            bg: props.colorScheme === 'green' ? 'green.600' :
                                props.colorScheme === 'red' ? 'red.600' :
                                props.colorScheme === 'blue' ? 'blue.700' : undefined,
                        },
                        _active: { 
                            bg: props.colorScheme === 'green' ? 'green.700' :
                                props.colorScheme === 'red' ? 'red.700' :
                                props.colorScheme === 'blue' ? 'blue.800' : undefined,
                        }
                    }
                }),
                outline: (props: StyleFunctionProps ) => ({
                    border: '2px solid',
                    _light: {
                        color: props.colorScheme === 'gray' ? 'blue.600' : undefined,
                        _hover: { 
                            bg: 'gray.100'
                        },
                        _active: { 
                            bg: 'gray.200'
                        }
                    },
                    _dark: {
                        color:
                            props.colorScheme === 'green' ? 'green.400' :
                            props.colorScheme === 'red' ? 'red.400' :
                            props.colorScheme === 'blue' ? 'blue.300' : undefined,
                        _hover: { 
                            bg: props.colorScheme === 'green' ? 'gray.600' :
                                props.colorScheme === 'red' ? 'gray.600' :
                                props.colorScheme === 'blue' ? 'gray.600' : undefined,
                        },
                        _active: { 
                            bg: props.colorScheme === 'green' ? 'gray.500' :
                                props.colorScheme === 'red' ? 'gray.500' :
                                props.colorScheme === 'blue' ? 'gray.500' : undefined,
                        }
                    }
                }),
                ghost: (props: StyleFunctionProps ) => ({
                    _light: {
                        color: props.colorScheme === 'gray' ? 'blue.600' : undefined,
                        _hover: { 
                            bg: 'gray.100'
                        },
                        _active: { 
                            bg: 'gray.200'
                        }
                    },
                    _dark: {
                        color:
                            props.colorScheme === 'green' ? 'green.400' :
                            props.colorScheme === 'red' ? 'red.400' :
                            props.colorScheme === 'blue' ? 'blue.300' : undefined,
                        _hover: { 
                            bg: props.colorScheme === 'green' ? 'gray.600' :
                                props.colorScheme === 'red' ? 'gray.600' :
                                props.colorScheme === 'blue' ? 'gray.600' : undefined,
                        },
                        _active: { 
                            bg: props.colorScheme === 'green' ? 'gray.500' :
                            props.colorScheme === 'red' ? 'gray.500' :
                            props.colorScheme === 'blue' ? 'gray.500' : undefined,
                        }
                    }
                }),
                link: (props: StyleFunctionProps ) => ({
                    _light: {
                        color:
                            props.colorScheme === 'green' ? 'green.400' :
                            props.colorScheme === 'red' ? 'red.500' :
                            props.colorScheme === 'blue' ? 'customColors.baseBlue' : undefined,
                    },
                    _dark: {
                        color:
                            props.colorScheme === 'green' ? 'green.200' :
                            props.colorScheme === 'red' ? 'red.300' :
                            props.colorScheme === 'blue' ? 'customColors.baseBlueLight' : undefined,
                    }
                })
            }
        },
        IconButton: {
            variants: {
                ghost: {
                    _light: {
                        _hover: { 
                            bg: 'gray.200'
                        },
                        _active: { 
                            bg: 'gray.300'
                        }
                    },
                    _dark: {
                        _hover: { 
                            bg: 'gray.700'
                        },
                        _active: { 
                            bg: 'gray.600'
                        }
                    }
                }
            },
        },
        CloseButton: {
            baseStyle: {
                borderRadius: 'full',
                _light: {
                    _focusVisible: {
                        boxShadow: "none",
                        outline: '2px solid var(--chakra-colors-customColors-baseBlue)'
                      },
                },
                _dark: {
                    _focusVisible: {
                        boxShadow: "none",
                        outline: '2px solid var(--chakra-colors-customColors-baseBlueLight)'
                      },
                },
            }
        },
        /**
         * Checkbox itself is always the same size but label's fontSize changes according to Checkbox size. 'sm', 'md' and 'lg' sizes available. Defaults to 'sm'.
         * Green is the only color option for Checkboxes. 
         */
        Checkbox: {
            baseStyle: {
                label: {
                    fontSize: 'sm'
                },
                control: {
                    height: 4,
                    width: 4,
                    borderRadius: '3px',
                    _disabled: {
                        opacity: 0.3,
                    },
                    _light: {
                        borderColor: 'gray.300',
                        _focusVisible: {
                            boxShadow: "none",
                            outline: '2px solid var(--chakra-colors-customColors-baseBlue)',
                            outlineOffset: '2px'
                          },
                        _checked: {
                            bg: 'green.500',
                            borderColor: 'green.500',
                            color: 'white',
                            _hover: {
                                bg: 'green.600',
                                borderColor: 'green.600'
                            },
                        },
                    },
                    _dark: {
                        borderColor: 'gray.500',
                        _focusVisible: {
                            boxShadow: "none",
                            outline: '2px solid var(--chakra-colors-customColors-baseBlueLight)',
                            outlineOffset: '2px'
                          },
                        _checked: {
                            bg: 'green.500',
                            borderColor: 'green.500',
                            color: 'whiteAlpha.900',
                            _hover: {
                                bg: 'green.600',
                                borderColor: 'green.600'
                            },
                        },
                    },
                },
                icon: {
                    fontSize: '2xs',
                },
            },
            defaultProps: {
                colorScheme: 'green',
                size: null
            },
            sizes: {
                sm: null
            }
        },
         /** 
         * Green is the only color option for Switches. 
         * */
        Switch: {
            baseStyle: {
                track: {
                    _light: {
                        _focusVisible: {
                            boxShadow: "none",
                            outline: '2px solid var(--chakra-colors-customColors-baseBlue)',
                            outlineOffset: '2px'
                        },
                        _checked: {
                            bg: 'green.500',
                            _hover: {
                                bg: 'green.600'
                            },
                        }
                    },
                    _dark: {
                        _focusVisible: {
                            boxShadow: "none",
                            outline: '2px solid var(--chakra-colors-customColors-baseBlueLight)',
                            outlineOffset: '2px'
                        },
                        _checked: {
                            bg: 'green.500',
                            _hover: {
                                bg: 'green.600'
                            },
                        }
                    },
                }
            },
            defaultProps: {
                colorScheme: 'green'
            }
        },
        /** 
         * Radio button itself is always the same size but label's fontSize changes according to Radio size. 'sm', 'md' and 'lg' sizes available. Defaults to 'sm'.
         * Green is the only color option for Radio buttons. 
         * */
        Radio: {
            baseStyle: {
                label: {
                    fontSize: 'sm'
                },
                control: {
                    height: 4,
                    width: 4, 
                    _disabled: {
                        opacity: 0.3,
                    },
                    _light: {
                        borderColor: 'gray.300',
                        _focusVisible: {
                            boxShadow: "none",
                            outline: '2px solid var(--chakra-colors-customColors-baseBlue) !important',
                            outlineOffset: '1px'
                          },
                        _checked: {
                            bg: 'green.500',
                            color: 'green.500',
                            border: '2px solid white',
                            outline: '2px solid var(--chakra-colors-green-500)',
                            _hover: {
                                bg: 'green.600',
                                color: 'green.600',
                                outline: '2px solid var(--chakra-colors-green-600)',
                            },
                        }
                    },
                    _dark: {
                        borderColor: 'gray.500',
                        _focusVisible: {
                            boxShadow: "none",
                            outline: '2px solid var(--chakra-colors-customColors-baseBlueLight) !important',
                            outlineOffset: '2px'
                          },
                        _checked: {
                            bg: 'green.500',
                            color: 'green.500',
                            border: '2px solid var(--chakra-colors-gray-800)',
                            outline: '2px solid var(--chakra-colors-green-500)',
                            _hover: {
                                bg: 'green.600',
                                color: 'green.600',
                                outline: '2px solid var(--chakra-colors-green-600)',
                            },
                        }
                    },
                },
            },
            defaultProps: {
                colorScheme: 'green',
                size: null
            },
            sizes: {
                sm: null
            }
        },
        Tabs: {
            variants: {
                hailer: (props: StyleFunctionProps) => ({
                    tab: {
                        color: 'chakra-placeholder-color',
                        borderBottom: '2px solid',
                        borderColor: 'chakra-border-color',
                        _active: {
                            bg: props.colorMode === 'dark' ? "gray.700" : "gray.50"
                        },
                        _selected: {
                            borderColor: 'green.500',
                            color: 'chakra-body-text',
                        },
                        _light: {
                            _focusVisible: {
                                boxShadow: "none",
                                outline: '2px solid var(--chakra-colors-customColors-baseBlue)'
                              },
                        },
                        _dark: {
                            _focusVisible: {
                                boxShadow: "none",
                                outline: '2px solid var(--chakra-colors-customColors-baseBlueLight)'
                              },
                        },
                    },
                })
            },
            defaultProps: {
                variant: 'hailer',
                isFitted: true
            }
        },
        Input: {
            variants: {
                filled: {
                    field: {
                        borderRadius: 'lg',
                        _light: {
                            _focus: {
                                bg: 'gray.50',
                            },
                            _focusVisible: {
                                bg: 'gray.50',
                            },
                        },
                        _dark: {
                            _focus: {
                                bg: 'gray.800',
                            },
                            _focusVisible: {
                                bg: 'gray.800',
                            },
                        }
                    }
                }
            },
            defaultProps: {
                variant: 'filled',
                focusBorderColor: 'green.500',
                errorBorderColor: 'red.500'
            }
        },
        NumberInput: {
            variants: {
                filled: (props: StyleFunctionProps) => ({
                    field: {
                        borderRadius: 'lg',
                        _focus: {
                            bg: props.colorMode === 'dark' ? 'gray.800' : 'gray.50',
                        },
                        _focusVisible: {
                            bg: props.colorMode === 'dark' ? 'gray.800' : 'gray.50',
                        },
                    },
                })
            },
            defaultProps: {
                variant: 'filled',
                focusBorderColor: 'green.500',
                errorBorderColor: 'red.500'
            }
        },
        Textarea: {
            variants: {
                filled: {
                    borderRadius: 'lg',
                    _light: {
                        _focus: {
                            bg: 'gray.50',
                        },
                        _focusVisible: {
                            bg: 'gray.50',
                        }
                    },
                    _dark: {
                        _focus: {
                            bg: 'gray.800',
                        },
                        _focusVisible: {
                            bg: 'gray.800',
                        },
                    }
                }
            },
            defaultProps: {
                variant: 'filled',
                focusBorderColor: 'green.500',
                errorBorderColor: 'red.500'
            }
        },
        Select: {
            variants: {
                filled: (props: StyleFunctionProps) => ({
                    field: {
                        borderRadius: 'lg',
                        _focus: {
                            bg: props.colorMode === 'dark' ? 'gray.800' : 'gray.50',
                            borderColor: 'green.500'
                        },
                        _focusVisible: {
                            bg: props.colorMode === 'dark' ? 'gray.800' : 'gray.50',
                            borderColor: 'green.500'
                        },
                        _invalid: {
                            borderColor: 'red.500'
                        }
                    },
                })
            },
            defaultProps: {
                variant: 'filled'
            }
        },
        FormLabel: {
            baseStyle: {
                fontSize: 'xs',
                fontWeight: 'bold',
                mb: 0.5,
                mt: 4
            }
        },
        Form: {
            baseStyle: {
                helperText: {
                    fontSize: 'xs',
                    mt: 0.5
                },
                requiredIndicator: {
                    color: 'chakra-body-text'
                }
            }
        },
        FormError: {
            baseStyle: {
                text: {
                    fontSize: 'xs',
                    mt: 0.5,
                }
                
            }
        },
        Menu: {
            baseStyle: {
                item: {
                    fontSize: 'sm',
                    letterSpacing: 'wide',
                    minHeight: '44px',
                },
                groupTitle: {
                    fontWeight: 'bold'
                },
                list: {
                    border: 'none',
                    shadow: 'lg'
                },
                divider: {
                    color: 'gray.200',
                    _dark: {
                        color: 'gray.500'
                    }
                }
            },
        },
        Tooltip: {
            variants: {
                hailer: {
                    bg: $bg.reference,
                    color: $fg.reference,
                    [$arrowBg.variable]: $bg.reference,
                    borderRadius: 'md',
                    _light: {
                        [$bg.variable]: "white",
                        [$fg.variable]: "chakra-body-text",
                    },
                    _dark: {
                        [$bg.variable]: "colors.gray.700",
                        [$fg.variable]: "chakra-body-text",
                    },
                }
            },
            defaultProps: {
                variant: 'hailer'
            },
        },
        Badge: {
            baseStyle: {
                borderRadius: 'md'
            },
            defaultProps: {
                variant: 'solid'
            }
        },
        Tag: {
            baseStyle: {
                container: {
                    borderRadius: 'full'
                },
                closeButton: {
                    _light: {
                        _focusVisible: {
                            boxShadow: "none",
                            outline: '2px solid var(--chakra-colors-customColors-baseBlue)'
                          },
                    },
                    _dark: {
                        _focusVisible: {
                            boxShadow: "none",
                            outline: '2px solid var(--chakra-colors-customColors-baseBlueLight)'
                          },
                    },
                }
            },
            sizes: {
                sm: {
                    container: {   
                        minHeight: '1rem',
                    }
                }
            },
            defaultProps: {
                size: 'sm',
                variant: 'solid'
            }
        },
        Stat: {
            baseStyle: {
                label: {
                    fontWeight: 'semibold'
                },
                number: {
                    fontWeight: 'bold'
                }
            }
        },
        Table: {
            baseStyle: (props: StyleFunctionProps) => ({
                thead: {
                    bg: props.colorMode === 'dark' ? 'gray.800' : 'gray.100',
                    color: props.colorMode === 'dark' ? 'gray.400' : 'gray.600',
                    "th:first-of-type": {
                        borderTopLeftRadius: "sm",
                      },
                    "th:last-child": {
                        borderTopRightRadius: "sm",
                      },                  
                },
                th: {
                    textTransform: 'none',
                    letterSpacing: 'wide',  
                },
            }),
            sizes: {
                sm: {
                    thead: {
                        height: '2rem'
                    }
                },
                md: {
                    th: {
                        fontSize: 'xs'
                    },
                    td: {
                        fontSize: 'sm'
                    }
                },
                lg: {
                    th: {
                        fontSize: 'sm'
                    }
                }
            },
            variants: {
                striped: (props: StyleFunctionProps) => ({
                    tbody: {
                        tr: {
                            "&:nth-of-type(even)": {
                              "th, td": {
                                borderBottomWidth: "1px",
                                borderColor: props.colorMode === 'dark' ? 'gray.600' : 'gray.50',
                              },
                              td: {
                                background: props.colorMode === 'dark' ? 'gray.600' : 'gray.50'
                              },
                            },
                            "&:nth-of-type(odd)": {
                                "th, td": {
                                  borderBottomWidth: "1px",
                                  borderColor: props.colorMode === 'dark' ? 'gray.600' : 'gray.50',
                                },
                                td: {
                                  background: 'transparent'
                                },
                              },
                        },
                    }
                }),
                simple: (props: StyleFunctionProps) => ({
                    tbody: {
                        tr: {
                            "th, td": {
                            borderBottomWidth: "1px",
                            borderColor: props.colorMode === 'dark' ? 'chakra-border-color' : 'gray.200',
                            }
                        },
                    }
                }),
            },
            defaultProps: {
                variant: 'simple'
            }
        },
        Card: {
            baseStyle: {
                container: {
                    borderRadius: 'lg'
                },
            },
            variants: {
                filled: (props: StyleFunctionProps) => ({
                    container: {
                        bg: props.colorMode === 'dark' ? 'gray.700' : 'white'
                    }
                }),
                elevated: {
                    container: {
                        shadow: 'md'
                    }
                }
            },
            defaultProps: {
                variant: 'filled'
            }
        },
        Modal: {
            baseStyle: {
                dialog: {
                    borderRadius: 'lg'
                },
                header: {
                    color: 'whiteAlpha.900',
                    borderTopLeftRadius: "lg",
                    borderTopRightRadius: "lg",
                    fontWeight: 'bold',
                    fontSize: 'lg',
                    maxHeight: '56px',
                    _light: {
                        bg: 'blue.600',
                       
                    },
                    _dark: {
                        bg: 'gray.800',
                    } 
                },
                body: {
                    pt: 6
                },
                footer: {
                    pb: 6,
                    button: {
                        width: '175px',
                        m: 1.5
                    }
                },
                closeButton: {
                    color: 'whiteAlpha.900',
                    mt: 1
                }
            },
            /**
            * size '7xl' is Hailer's custom size (one size before full viewport)
            */
            sizes: {
                '7xl': {
                    dialog: {
                        m: 5
                    }  
                },
                md: {
                    footer: {
                        button: {
                            width: '50%'
                        }
                    }   
                },
                full: {
                    header: {
                        borderTopLeftRadius: 0,
                        borderTopRightRadius: 0
                    }
                }
            },
        },
        Popover: {
            baseStyle: {
                content: {
                    border: 'none',
                    shadow: 'lg',
                },
                arrow: {
                    _light: {
                        [$arrowShadowColor.variable]: `white`,
                    },
                    _dark: {
                        [$arrowShadowColor.variable]: `colors.gray.700`,
                    }  
                },
                header: {
                    color: 'whiteAlpha.900',
                    borderTopLeftRadius: "lg",
                    borderTopRightRadius: "lg",
                    borderBottomWidth: 0,
                    fontWeight: 'semibold',
                    fontSize: 'md',
                    _light: {
                        bg: 'blue.600', 
                    },
                    _dark: {
                        bg: 'gray.800',
                    } 
                },
                body: {
                    px: 5
                },
                footer: {
                    display: 'flex',
                    justifyContent: 'center',
                    borderTopWidth: 0,
                    pt: 0,
                    button: {
                        width: '50%',
                        m: 1.5,
                    }
                },
                closeButton: {
                    color: 'whiteAlpha.900',
                    mt: 1
                },
            },
        },
         /**
         * colorSchemes as statuses => red = 'error'; green = 'success'; orange = 'warning'; blue = 'info' and 'loading'
         * Alerts with status="warning" and variant="subtle" can be used as Hailer notes
         */
        Alert: { 
            variants: {
                subtle: ( props: StyleFunctionProps ) => ({
                    container: {
                        _light: {
                            bg: props.colorScheme === 'red' ? 'red.50' : 
                                props.colorScheme === 'green' ? 'green.50' : 
                                props.colorScheme === 'orange' ? 'orange.100' : 
                                props.colorScheme === 'blue' ? 'blue.50' : undefined,
                            color: props.colorScheme === 'red' ? 'red.900' : 
                                props.colorScheme === 'green' ? 'green.900' : 
                                props.colorScheme === 'orange' ? 'orange.900' : 
                                props.colorScheme === 'blue' ? 'blue.900' : undefined,
                            
                        },
                        _dark: {
                            bg: props.colorScheme === 'red' ? 'red.700' : 
                                props.colorScheme === 'green' ? 'green.700' : 
                                props.colorScheme === 'orange' ? 'orange.900' : 
                                props.colorScheme === 'blue' ? 'blue.700' : undefined,
                            color: 'whiteAlpha.900',
                        }
                    },
                    icon: {
                        _light: {
                            color: props.colorScheme === 'red' ? 'red.500' : 
                                    props.colorScheme === 'green' ? 'green.500' : 
                                    props.colorScheme === 'orange' ? 'orange.500' : 
                                    props.colorScheme === 'blue' ? 'blue.500' : undefined,
                        },
                        _dark: {
                            color: props.colorScheme === 'red' ? 'red.100' : 
                                    props.colorScheme === 'green' ? 'green.100' : 
                                    props.colorScheme === 'orange' ? 'orange.100' : 
                                    props.colorScheme === 'blue' ? 'blue.100' : undefined,
                        }
                    },
                    spinner: {
                        _light: {
                            color: props.colorScheme === 'red' ? 'red.600' : 
                                    props.colorScheme === 'green' ? 'green.600' : 
                                    props.colorScheme === 'orange' ? 'orange.600' : 
                                    props.colorScheme === 'blue' ? 'blue.600' : undefined,
                        },
                        _dark: {
                            color: props.colorScheme === 'red' ? 'red.100' : 
                                    props.colorScheme === 'green' ? 'green.100' : 
                                    props.colorScheme === 'orange' ? 'orange.100' : 
                                    props.colorScheme === 'blue' ? 'blue.100' : undefined,
                        }
                    },
                }),
                solid: ( props: StyleFunctionProps ) => ({
                    container: {
                        _light: {
                            bg: props.colorScheme === 'red' ? 'red.500' : 
                                props.colorScheme === 'green' ? 'green.500' : 
                                props.colorScheme === 'orange' ? 'orange.500' : 
                                props.colorScheme === 'blue' ? 'blue.500' : undefined,
                            color: 'white',
                        },
                        _dark: {
                            bg: props.colorScheme === 'red' ? 'red.700' : 
                                props.colorScheme === 'green' ? 'green.700' : 
                                props.colorScheme === 'orange' ? 'orange.900' : 
                                props.colorScheme === 'blue' ? 'blue.700' : undefined,
                            color: 'whiteAlpha.900'
                        }
                    },
                    icon: {
                        _light: {
                            color: props.colorScheme === 'red' ? 'red.50' : 
                                    props.colorScheme === 'green' ? 'green.50' : 
                                    props.colorScheme === 'orange' ? 'orange.50' : 
                                    props.colorScheme === 'blue' ? 'blue.50' : undefined,
                        },
                        _dark: {
                            color: props.colorScheme === 'red' ? 'red.100' : 
                                    props.colorScheme === 'green' ? 'green.100' : 
                                    props.colorScheme === 'orange' ? 'orange.100' : 
                                    props.colorScheme === 'blue' ? 'blue.100' : undefined,
                        }
                    },
                    spinner: {
                        _light: {
                            color: props.colorScheme === 'red' ? 'red.50' : 
                                    props.colorScheme === 'green' ? 'green.50' : 
                                    props.colorScheme === 'orange' ? 'orange.50' : 
                                    props.colorScheme === 'blue' ? 'blue.50' : undefined,
                        },
                        _dark: {
                            color: props.colorScheme === 'red' ? 'red.100' : 
                                    props.colorScheme === 'green' ? 'green.100' : 
                                    props.colorScheme === 'orange' ? 'orange.100' : 
                                    props.colorScheme === 'blue' ? 'blue.100' : undefined,
                        }
                    },

                })
            },
            defaultProps: {
                variant: 'subtle'
            }
        },
        Drawer: {
            baseStyle: {
                footer: {
                    button: {
                        width: '175px',
                        m: 1
                    }
                },
            }
        },
         /**
         * Avatars: Default background color for the badge is gray (inactive/offline). For active badge use bg='green.500'.
         * Only sizes 'hailer-sm', 'hailer-md' and 'hailer-lg' are styled for Hailer theme. Other sizes are available from Chakra UI default theme but won't have Hailer styling out of the box.
         */
        Avatar: {
            sizes: {
                'hailer-sm': ( props: StyleFunctionProps ) => ({
                    container: {
                        height: 9,
                        width: 9,
                        fontSize: 'sm',
                        "&:not([data-loaded])": {
                            bg: 'gray.400',
                        }
                    },
                    badge: {
                        boxSize: '0.9em',
                        borderWidth: '0.1em',
                        bg: 'gray.400'
                     },
                     excessLabel: {
                        bg: 'blue.600',
                        color: 'white',
                        height: 9,
                        width: 9,
                        borderWidth: '2px',
                        borderColor: props.colorMode === 'dark' ? 'gray.800' : 'white',
                        fontSize: 'sm'
                    }
                }),
                'hailer-md': ( props: StyleFunctionProps ) => ({
                    container: {
                        height: 10,
                        width: 10,
                        fontSize: 'md',
                        "&:not([data-loaded])": {
                            bg: 'gray.400',
                        }
                    },
                    badge: {
                       boxSize: '0.9em',
                       borderWidth: '0.1em',
                       bg: 'gray.400'
                    },
                    excessLabel: {
                        bg: 'blue.600',
                        color: 'white',
                        height: 10,
                        width: 10,
                        borderWidth: '2px',
                        borderColor: props.colorMode === 'dark' ? 'gray.800' : 'white',
                        fontSize: 'md'
                    }
                }),
                'hailer-lg': ( props: StyleFunctionProps ) => ({
                    container: {
                        height: '2.75rem',
                        width: '2.75rem',
                        fontSize: 'lg',
                        "&:not([data-loaded])": {
                            bg: 'gray.400',
                        }
                    },
                    badge: {
                       boxSize: '0.9em',
                       borderWidth: '0.1em',
                       bg: 'gray.400'
                    },
                    excessLabel: {
                        bg: 'blue.600',
                        color: 'white',
                        height: '2.75rem',
                        width: '2.75rem',
                        borderWidth: '2px',
                        borderColor: props.colorMode === 'dark' ? 'gray.800' : 'white',
                        fontSize: 'lg'
                    }
                }), 
            },
            defaultProps: {
                size: 'hailer-md',
            }
        },
        Slider: {
            baseStyle: (props: StyleFunctionProps ) => ({
                thumb: {
                    _light: {
                        _focusVisible: {
                            boxShadow: "none",
                            outline: '2px solid var(--chakra-colors-customColors-baseBlue)'
                          },
                    },
                    _dark: {
                        _focusVisible: {
                            boxShadow: "none",
                            outline: '2px solid var(--chakra-colors-customColors-baseBlueLight)'
                          },
                    }
                },
                filledTrack: {
                    _dark: {
                        bg: props.colorScheme === 'green' ? 'green.500' :
                            props.colorScheme === 'blue' ? 'blue.500' : undefined,
                    }
                }
            }),
            defaultProps: {
                colorScheme: 'green',
            }
        },
        Progress: {
            baseStyle: (props: StyleFunctionProps ) => ({
                filledTrack: {
                    _dark: {
                        bg: props.colorScheme === 'green' ? 'green.500' :
                            props.colorScheme === 'blue' ? 'blue.500' : undefined,
                    }
                }
            }),
            defaultProps: {
                colorScheme: 'green',
            }
        },
    }
});

export default hailerTheme;