SELECT FROM Countries [ ORDER BY name ] {
  code, name, regions [ ORDER BY name ] {
    code, name, children [ ORDER BY name ] {
      code, name, children [ ORDER BY name ] {
        code, name, cities [ ORDER BY name ] {
          code, name, districts [ ORDER BY name ] {
            code, name
          }
        }
      },
      cities [ ORDER BY name ] {
        code, name, districts [ ORDER BY name ] {
          code, name
        }
      }
    },
    cities [ ORDER BY name ] {
      code, name, districts [ ORDER BY name ] {
        code, name
      }
    }
  }
}