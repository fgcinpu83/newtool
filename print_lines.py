import sys
path=sys.argv[1]
with open(path,'r',encoding='utf-8') as f:
    for i,line in enumerate(f,1):
        if i<=20:
            print(f"{i}:{line!r}")
